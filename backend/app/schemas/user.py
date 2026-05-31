from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")


class UserEmailUpdate(BaseModel):
    email: EmailStr
    current_password: str = Field(min_length=8, max_length=128)


class UserPasswordUpdate(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
