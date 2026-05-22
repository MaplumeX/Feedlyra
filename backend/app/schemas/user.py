from __future__ import annotations

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    username: str

    model_config = {"from_attributes": True}
