"""Agent tool schema and in-process tool execution.

Two MVP tools (see design.md §Tool Schema):
  - search_articles(query): retrieve candidate articles over the user's feeds
  - read_article(article_id): pull an article's full readable_content

Tools run in-process (no extra HTTP). Their results are returned to the model
as JSON strings (the OpenAI tool-calling protocol requires tool message
content to be a string).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import ConversationReference
from app.models.article import Article
from app.models.feed import Feed
from app.services.retrieval import retrieve_relevant_articles, _tokenize

# How much of the cached summary to surface per candidate. Long summaries waste
# the model's context budget without improving hit-rate on follow-up read_article.
_SUMMARY_SNIPPET_LEN = 200

# read_article returns full content, but cap it so one tool result can't blow
# the model's context window. The model already has title + can quote from this.
_MAX_READ_CONTENT_CHARS = 8000

# search Articles over the user's subscription feeds within a recent window.
_SEARCH_WINDOW_DAYS = 7
_SEARCH_LIMIT = 5

# Tool schema exposed to the LLM. Keep descriptions action-oriented so the model
# knows when to call each tool — these descriptions drive tool selection.
TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_articles",
            "description": (
                "在用户已订阅的文章源内按关键词搜索文章。"
                "当用户问及某话题/某期内容/想看文章时调用。"
                "返回候选列表（id/标题/摘要片段），需进一步精读时用 read_article。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，从用户问题提炼实词；搜不到时可换词重搜。",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_article",
            "description": (
                "拉取某篇文章的全文用于精读回答。需先 search_articles 拿到 article_id。"
                "返回 {id,title,content}。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "article_id": {
                        "type": "string",
                        "description": "search_articles 返回的候选 id",
                    }
                },
                "required": ["article_id"],
            },
        },
    },
]

_TOOL_NAMES = {t["function"]["name"] for t in TOOLS}


@dataclass(frozen=True)
class ToolResult:
    """Outcome of executing one tool call.

    `content` is the JSON string fed back to the model as the tool message.
    `summary` is a short human-facing line shown via SSE (tool_call_end).
    """

    content: str
    summary: str


def _to_search_result(articles: list[Article]) -> list[dict]:
    out: list[dict] = []
    for a in articles:
        # Use cached feed summary snippet if present; retrieval already loaded
        # Article rows, not summaries, so fall back to content_snippet.
        snippet = (a.content_snippet or "")[:_SUMMARY_SNIPPET_LEN]
        out.append(
            {
                "id": str(a.id),
                "title": a.title,
                "summary_snippet": snippet,
            }
        )
    return out


async def _search_articles(
    query: str, *, user_id: UUID, db: AsyncSession
) -> ToolResult:
    tokens = _tokenize(query)
    if not tokens:
        # Nothing searchable — return empty list rather than running a useless query.
        empty = json.dumps({"query": query, "results": [], "count": 0}, ensure_ascii=False)
        return ToolResult(content=empty, summary="未提取到搜索词，跳过搜索")

    since = datetime.now(timezone.utc) - timedelta(days=_SEARCH_WINDOW_DAYS)
    articles = await retrieve_relevant_articles(
        db, user_id=user_id, query=query, since=since, limit=_SEARCH_LIMIT
    )
    results = _to_search_result(articles)
    payload = json.dumps(
        {"query": query, "results": results, "count": len(results)},
        ensure_ascii=False,
    )
    summary = f"找到 {len(results)} 篇"
    return ToolResult(content=payload, summary=summary)


async def _read_article(
    article_id: str, *, user_id: UUID, conversation_id: UUID, db: AsyncSession
) -> ToolResult:
    try:
        aid = UUID(article_id)
    except ValueError:
        err = json.dumps(
            {"error": "invalid article_id", "article_id": article_id},
            ensure_ascii=False,
        )
        return ToolResult(content=err, summary="article_id 无效")

    # Scope by Feed.user_id so a user can only read their own subscribed
    # articles — never trust the bare id from the model.
    result = await db.execute(
        select(Article)
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.user_id == user_id, Article.id == aid)
    )
    article = result.scalar_one_or_none()
    if article is None:
        err = json.dumps(
            {"error": "not found", "article_id": article_id}, ensure_ascii=False
        )
        return ToolResult(content=err, summary="未找到文章")

    content = (article.readable_content or "")[:_MAX_READ_CONTENT_CHARS]
    payload = json.dumps(
        {
            "id": str(article.id),
            "title": article.title,
            "content": content,
        },
        ensure_ascii=False,
    )
    summary = f"正在阅读《{article.title[:40]}》"

    # Record that the agent read this article: write an is_auto=True reference
    # so the conversation's "related articles" side-panel reflects agent usage.
    # Ignore duplicate-key conflicts — the agent may legitimately read the same
    # article twice in a session; we only need one reference row.
    # Use a savepoint so a conflict rolls back only this insert, not the whole
    # transaction (which holds the assistant tool_call message not yet committed).
    try:
        async with db.begin_nested():
            db.add(
                ConversationReference(
                    conversation_id=conversation_id,
                    article_id=article.id,
                    is_auto=True,
                )
            )
    except IntegrityError:
        pass

    return ToolResult(content=payload, summary=summary)


async def execute_tool(
    name: str,
    args: dict,
    *,
    user_id: UUID,
    conversation_id: UUID,
    db: AsyncSession,
) -> ToolResult:
    """Dispatch a tool call by name. Returns the tool result for the model."""
    if name not in _TOOL_NAMES:
        err = json.dumps({"error": f"unknown tool: {name}"}, ensure_ascii=False)
        return ToolResult(content=err, summary=f"未知工具 {name}")

    if name == "search_articles":
        query = str(args.get("query", "")).strip()
        if not query:
            err = json.dumps({"error": "missing query"}, ensure_ascii=False)
            return ToolResult(content=err, summary="缺少搜索词")
        return await _search_articles(query, user_id=user_id, db=db)

    if name == "read_article":
        article_id = str(args.get("article_id", "")).strip()
        if not article_id:
            err = json.dumps({"error": "missing article_id"}, ensure_ascii=False)
            return ToolResult(content=err, summary="缺少 article_id")
        return await _read_article(
            article_id, user_id=user_id, conversation_id=conversation_id, db=db
        )

    # Unreachable: covered by _TOOL_NAMES check above. Defensive only.
    err = json.dumps({"error": f"unknown tool: {name}"}, ensure_ascii=False)
    return ToolResult(content=err, summary=f"未知工具 {name}")
