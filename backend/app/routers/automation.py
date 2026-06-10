from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.automation import AutomationRule
from app.models.category import Category
from app.models.feed import Feed
from app.models.user import User
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleResponse,
    AutomationRuleUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/automation-rules", tags=["automation"])


@router.post("", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: AutomationRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AutomationRule:
    _validate_scope(body.scope, body.scope_id)

    if body.scope == "category" and body.scope_id is not None:
        result = await db.execute(
            select(Category).where(Category.id == body.scope_id, Category.user_id == user.id)
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Category not found")
    elif body.scope == "feed" and body.scope_id is not None:
        result = await db.execute(
            select(Feed).where(Feed.id == body.scope_id, Feed.user_id == user.id)
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Feed not found")

    rule = AutomationRule(
        user_id=user.id,
        name=body.name,
        enabled=body.enabled,
        scope=body.scope,
        scope_id=body.scope_id,
        conditions=[c.model_dump() for c in body.conditions],
        actions=[a.model_dump() for a in body.actions],
        priority=body.priority,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("", response_model=list[AutomationRuleResponse])
async def list_rules(
    scope: str | None = Query(None, pattern=r"^(global|category|feed)$"),
    scope_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AutomationRule]:
    query = (
        select(AutomationRule)
        .where(AutomationRule.user_id == user.id)
        .order_by(AutomationRule.priority.desc(), AutomationRule.created_at)
    )
    if scope is not None:
        query = query.where(AutomationRule.scope == scope)
    if scope_id is not None:
        query = query.where(AutomationRule.scope_id == scope_id)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{rule_id}", response_model=AutomationRuleResponse)
async def get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AutomationRule:
    rule = await _get_owned_rule(db, rule_id, user.id)
    return rule


@router.put("/{rule_id}", response_model=AutomationRuleResponse)
async def update_rule(
    rule_id: UUID,
    body: AutomationRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AutomationRule:
    rule = await _get_owned_rule(db, rule_id, user.id)

    update_data = body.model_dump(exclude_unset=True)

    if "scope" in update_data or "scope_id" in update_data:
        new_scope = update_data.get("scope", rule.scope)
        new_scope_id = update_data.get("scope_id", rule.scope_id)
        _validate_scope(new_scope, new_scope_id)

        if new_scope == "category" and new_scope_id is not None:
            result = await db.execute(
                select(Category).where(Category.id == new_scope_id, Category.user_id == user.id)
            )
            if result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Category not found")
        elif new_scope == "feed" and new_scope_id is not None:
            result = await db.execute(
                select(Feed).where(Feed.id == new_scope_id, Feed.user_id == user.id)
            )
            if result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Feed not found")

    if "name" in update_data:
        rule.name = update_data["name"]
    if "enabled" in update_data:
        rule.enabled = update_data["enabled"]
    if "scope" in update_data:
        rule.scope = update_data["scope"]
    if "scope_id" in update_data:
        rule.scope_id = update_data["scope_id"]
    if "conditions" in update_data:
        rule.conditions = [c.model_dump() if hasattr(c, "model_dump") else c for c in body.conditions]  # type: ignore[union-attr]
    if "actions" in update_data:
        rule.actions = [a.model_dump() if hasattr(a, "model_dump") else a for a in body.actions]  # type: ignore[union-attr]
    if "priority" in update_data:
        rule.priority = update_data["priority"]

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    rule = await _get_owned_rule(db, rule_id, user.id)
    await db.delete(rule)
    await db.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_owned_rule(
    db: AsyncSession, rule_id: UUID, user_id: UUID
) -> AutomationRule:
    result = await db.execute(
        select(AutomationRule).where(
            AutomationRule.id == rule_id, AutomationRule.user_id == user_id
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Automation rule not found")
    return rule


def _validate_scope(scope: str, scope_id: UUID | None) -> None:
    if scope == "global" and scope_id is not None:
        raise HTTPException(status_code=400, detail="Global rules must not have scope_id")
    if scope in ("category", "feed") and scope_id is None:
        raise HTTPException(status_code=400, detail=f"{scope.title()} rules require scope_id")
