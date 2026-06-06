from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/feedlyra"
    SECRET_KEY: str = "change-me-to-a-random-secret-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173"
    AI_DEFAULT_BASE_URL: str = "https://api.openai.com/v1"
    AI_DEFAULT_API_KEY: str = ""
    AI_DEFAULT_MODEL: str = "gpt-4o-mini"
    UPLOAD_DIR: str = "./uploads/chat_images"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
