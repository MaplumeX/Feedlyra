from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ConditionSchema(BaseModel):
    field: str = Field(..., pattern=r"^(title|author|url|content)$")
    operator: str = Field(..., pattern=r"^(contains|not_contains|matches_regex)$")
    value: str
    logic: str = Field(default="and", pattern=r"^(and|or)$")


class ActionSchema(BaseModel):
    type: str = Field(..., pattern=r"^(mark_read|star|delete|auto_translate|auto_extract)$")
    params: dict | None = None


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., max_length=255)
    enabled: bool = True
    scope: str = Field(..., pattern=r"^(global|category|feed)$")
    scope_id: UUID | None = None
    conditions: list[ConditionSchema]
    actions: list[ActionSchema]
    priority: int = 0


class AutomationRuleUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    enabled: bool | None = None
    scope: str | None = Field(None, pattern=r"^(global|category|feed)$")
    scope_id: UUID | None = None
    conditions: list[ConditionSchema] | None = None
    actions: list[ActionSchema] | None = None
    priority: int | None = None


class AutomationRuleResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    enabled: bool
    scope: str
    scope_id: UUID | None
    conditions: list[dict]
    actions: list[dict]
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
