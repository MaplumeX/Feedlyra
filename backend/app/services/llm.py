from __future__ import annotations

import base64
import hashlib
import json
import logging
from collections.abc import AsyncIterator

from cryptography.fernet import Fernet
from openai import AsyncOpenAI

from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 8000

SUMMARY_SYSTEM_PROMPT = (
    "You are a helpful assistant that summarizes articles. "
    "Summarize the following article in 3-5 bullet points. "
    "Focus on key facts and conclusions. "
    "Use the same language as the article."
)

TRANSLATION_SYSTEM_PROMPT = (
    "You are a professional translator. "
    "Translate the following article to {target_lang}. "
    "Preserve the original formatting and structure."
)

CHAT_SYSTEM_PROMPT = (
    "You are an AI assistant helping a user understand an article. "
    "Answer questions based solely on the article content below. "
    "If the answer is not in the article, say so. "
    "Use the same language as the user's question.\n\n"
    "ARTICLE:\n{article_content}"
)


def _get_fernet() -> Fernet:
    # Derive a valid 32-byte Fernet key from SECRET_KEY via SHA256
    derived = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_api_key(key: str) -> str:
    return _get_fernet().encrypt(key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


def get_user_llm_client(user: User) -> AsyncOpenAI:
    """Create an OpenAI client from user's BYOK config or fall back to server defaults."""
    base_url = user.ai_base_url or settings.AI_DEFAULT_BASE_URL
    api_key: str
    if user.ai_api_key:
        api_key = decrypt_api_key(user.ai_api_key)
    elif settings.AI_DEFAULT_API_KEY:
        api_key = settings.AI_DEFAULT_API_KEY
    else:
        raise ValueError("No API key configured. Please set up AI configuration in settings.")

    return AsyncOpenAI(base_url=base_url, api_key=api_key)


def get_user_model(user: User) -> str:
    return user.ai_model or settings.AI_DEFAULT_MODEL


async def generate_summary(client: AsyncOpenAI, model: str, title: str, content: str) -> str:
    """Generate article summary."""
    truncated = content[:MAX_CONTENT_CHARS] if content else ""
    user_message = f"Title: {title}\n\nContent:\n{truncated}"

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=500,
    )

    return response.choices[0].message.content or ""


async def translate_article(
    client: AsyncOpenAI,
    model: str,
    title: str,
    content: str,
    target_lang: str,
) -> tuple[str, str]:
    """Translate article title and content to target language."""
    truncated = content[:MAX_CONTENT_CHARS] if content else ""
    user_message = f"Title: {title}\n\nContent:\n{truncated}"

    system_prompt = TRANSLATION_SYSTEM_PROMPT.format(target_lang=target_lang)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        max_tokens=4000,
    )

    result = response.choices[0].message.content or ""
    translated_title = title
    translated_content = result

    # Try to split title and content if the model returns them separately
    if "\n" in result:
        lines = result.split("\n", 1)
        if lines[0].strip() and len(lines) > 1 and lines[1].strip():
            translated_title = lines[0].strip()
            translated_content = lines[1].strip()

    return translated_title, translated_content


async def stream_chat(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    """Stream chat completion, yielding content chunks."""
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
        temperature=0.7,
        max_tokens=2000,
    )

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def build_chat_messages(
    article_title: str,
    article_content: str,
    chat_history: list[dict],
    new_message: str,
) -> list[dict]:
    """Build messages list for chat API call."""
    truncated = article_content[:MAX_CONTENT_CHARS] if article_content else ""
    system_prompt = CHAT_SYSTEM_PROMPT.format(article_content=truncated)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Add recent chat history (last 10 turns to stay within context)
    for msg in chat_history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": new_message})
    return messages
