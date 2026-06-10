from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ReadStatus, StarredArticle
from app.models.automation import AutomationRule
from app.models.feed import Feed
from app.models.ai import ArticleAIData

logger = logging.getLogger(__name__)


def _matches_conditions(article: Article, conditions: list[dict]) -> bool:
    """Evaluate a list of conditions against an article using AND/OR logic.

    The first condition's logic field is ignored (treated as 'and').
    Subsequent conditions use their logic field to combine with the previous result.
    """
    if not conditions:
        return True

    result = True
    for i, cond in enumerate(conditions):
        field_value = getattr(article, cond["field"], "") or ""
        field_value = str(field_value).lower()
        cond_value = cond["value"].lower()

        if cond["operator"] == "contains":
            match = cond_value in field_value
        elif cond["operator"] == "not_contains":
            match = cond_value not in field_value
        elif cond["operator"] == "matches_regex":
            try:
                match = bool(re.search(cond["value"], field_value, re.IGNORECASE))
            except re.error:
                match = False
        else:
            match = False

        if i == 0:
            result = match
        elif cond.get("logic", "and") == "or":
            result = result or match
        else:
            result = result and match

    return result


def _rule_has_delete_action(rule: AutomationRule) -> bool:
    """Check if a rule has a delete action."""
    actions = rule.actions if isinstance(rule.actions, list) else []
    return any(a.get("type") == "delete" for a in actions)


async def _load_rules_for_feed(
    db: AsyncSession, user_id: UUID, feed: Feed
) -> list[AutomationRule]:
    """Load all enabled automation rules applicable to a feed.

    Scope resolution: global rules + category rules (if feed has category) + feed rules.
    """
    query = (
        select(AutomationRule)
        .where(
            AutomationRule.user_id == user_id,
            AutomationRule.enabled == True,  # noqa: E712
        )
        .order_by(AutomationRule.priority.desc(), AutomationRule.created_at)
    )

    # Filter for applicable scopes
    scope_conditions = [AutomationRule.scope == "global"]
    if feed.category_id is not None:
        scope_conditions.append(
            (AutomationRule.scope == "category") & (AutomationRule.scope_id == feed.category_id)
        )
    scope_conditions.append(
        (AutomationRule.scope == "feed") & (AutomationRule.scope_id == feed.id)
    )

    query = query.where(or_(*scope_conditions))

    result = await db.execute(query)
    return list(result.scalars().all())


async def apply_delete_rules(
    feed: Feed, articles: list[Article], db: AsyncSession
) -> list[Article]:
    """Filter out articles matching delete rules. Called before articles are stored."""
    if not articles:
        return articles

    rules = await _load_rules_for_feed(db, feed.user_id, feed)
    delete_rules = [r for r in rules if _rule_has_delete_action(r)]

    if not delete_rules:
        return articles

    surviving: list[Article] = []
    for article in articles:
        should_delete = False
        for rule in delete_rules:
            try:
                if _matches_conditions(article, rule.conditions if isinstance(rule.conditions, list) else []):
                    should_delete = True
                    break
            except Exception:
                logger.warning("Error evaluating delete rule %s, skipping", rule.id)

        if not should_delete:
            surviving.append(article)

    return surviving


async def apply_non_delete_rules(
    feed: Feed, articles: list[Article], db: AsyncSession
) -> None:
    """Apply non-delete actions to matching articles. Called after articles are stored."""
    if not articles:
        return

    rules = await _load_rules_for_feed(db, feed.user_id, feed)
    non_delete_rules = [r for r in rules if not _rule_has_delete_action(r)]

    if not non_delete_rules:
        return

    article_ids = {a.id for a in articles}
    existing_read_result = await db.execute(
        select(ReadStatus.article_id).where(
            ReadStatus.user_id == feed.user_id,
            ReadStatus.article_id.in_(article_ids),
        )
    )
    existing_read = {row[0] for row in existing_read_result.all()}

    existing_starred_result = await db.execute(
        select(StarredArticle.article_id).where(
            StarredArticle.user_id == feed.user_id,
            StarredArticle.article_id.in_(article_ids),
        )
    )
    existing_starred = {row[0] for row in existing_starred_result.all()}

    now = datetime.now(timezone.utc)

    for article in articles:
        for rule in non_delete_rules:
            try:
                conditions = rule.conditions if isinstance(rule.conditions, list) else []
                if not _matches_conditions(article, conditions):
                    continue

                actions = rule.actions if isinstance(rule.actions, list) else []
                for action in actions:
                    action_type = action.get("type", "")
                    try:
                        if action_type == "mark_read":
                            if article.id not in existing_read:
                                db.add(ReadStatus(
                                    user_id=feed.user_id,
                                    article_id=article.id,
                                    read_at=now,
                                ))
                                existing_read.add(article.id)

                        elif action_type == "star":
                            if article.id not in existing_starred:
                                db.add(StarredArticle(
                                    user_id=feed.user_id,
                                    article_id=article.id,
                                    starred_at=now,
                                ))
                                existing_starred.add(article.id)

                        elif action_type == "auto_translate":
                            params = action.get("params") or {}
                            target_lang = params.get("translate_target_lang", "zh")
                            await _apply_auto_translate(db, feed.user_id, article, target_lang)

                        elif action_type == "auto_extract":
                            await _apply_auto_extract(db, article)

                    except Exception:
                        logger.warning(
                            "Error applying action %s from rule %s to article %s, skipping",
                            action_type, rule.id, article.id,
                        )

            except Exception:
                logger.warning("Error evaluating rule %s, skipping", rule.id)

    # Flush changes so they are committed together with the feed commit
    try:
        await db.flush()
    except Exception:
        logger.warning("Error flushing automation rule changes")


async def _apply_auto_translate(
    db: AsyncSession, user_id: UUID, article: Article, target_lang: str
) -> None:
    """Apply auto_translate: translate article using user's AI config and store result."""
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return

    from app.services.llm import get_user_llm_client, get_user_model, translate_article

    try:
        client = get_user_llm_client(user, "translate")
    except ValueError:
        logger.warning("Cannot auto-translate article %s: missing AI config", article.id)
        return

    model = get_user_model(user, "translate")

    # Check for existing translation
    ai_data_result = await db.execute(
        select(ArticleAIData).where(ArticleAIData.article_id == article.id)
    )
    ai_data = ai_data_result.scalar_one_or_none()

    if (
        ai_data
        and ai_data.translated_content
        and ai_data.translation_lang == target_lang
        and ai_data.translation_model == model
    ):
        return  # Already translated

    translated_title, translated_content = await translate_article(
        client, model, article.title, article.readable_content, target_lang
    )

    now_translation = datetime.now(timezone.utc)

    if ai_data is None:
        ai_data = ArticleAIData(
            article_id=article.id,
            translated_title=translated_title,
            translated_content=translated_content,
            translation_lang=target_lang,
            translation_model=model,
            translation_created_at=now_translation,
        )
        db.add(ai_data)
    else:
        ai_data.translated_title = translated_title
        ai_data.translated_content = translated_content
        ai_data.translation_lang = target_lang
        ai_data.translation_model = model
        ai_data.translation_created_at = now_translation


async def _apply_auto_extract(db: AsyncSession, article: Article) -> None:
    """Apply auto_extract: fetch full content and store as full_content."""
    if article.full_content:
        return  # Already extracted

    from app.services.feed_fetcher import _fetch_and_extract_content

    extracted = await _fetch_and_extract_content(article.url)
    if extracted:
        article.full_content = extracted
