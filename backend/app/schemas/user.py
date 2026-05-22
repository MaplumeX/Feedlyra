from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str

    model_config = {"from_attributes": True}
