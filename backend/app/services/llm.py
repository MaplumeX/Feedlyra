from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Literal

from cryptography.fernet import Fernet
from openai import AsyncOpenAI

from app.config import settings
from app.models.user import User
from app.services.article_summary import extract_content_for_summary

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 20000

Feature = Literal["translate", "summary", "chat"]

SUMMARY_SYSTEM_PROMPT = """\
You are an expert content analyst for an RSS news reader. \
Your task is to help users quickly decide whether an article is worth reading.

Rules:
- Output a single concise paragraph, under 100 words.
- Prioritize: new findings/conclusions > actionable insights > key facts > context.
- Skip filler, ads, navigation text, and boilerplate in the content.
- Do NOT repeat the article title.
- If the content is too short or not a real article, output: "Content insufficient for summary."
- Use the same language as the article body. If ambiguous, use the title's language.\
"""

TRANSLATION_SYSTEM_PROMPT = (
    "You are a professional translator. "
    "Translate the following article to {target_lang}. "
    "Preserve the original formatting and structure.\n\n"
    "Output ONLY the translated text in this exact format:\n"
    "<translated_title>translated title here</translated_title>\n\n<translated_content>translated content here</translated_content>\n"
    "Do NOT add any extra text, labels, or explanations."
)

CHAT_SYSTEM_PROMPT = (
    "You are an AI assistant helping a user understand an article. "
    "Answer questions based on the article content below. "
    "If the answer is not in the article, say so clearly. "
    "Use the same language as the user's question.\n"
    "Be concise but thorough. When referencing the article, quote relevant parts.\n\n"
    "ARTICLE:\n{article_content}"
)

CHAT_MULTI_ARTICLE_SYSTEM_PROMPT = (
    "You are an AI assistant helping a user understand article(s). "
    "Answer questions based on the article content below. "
    "If the answer is not in the articles, say so clearly. "
    "Use the same language as the user's question.\n"
    "Be concise but thorough. When referencing the articles, quote relevant parts.\n\n"
    "{article_sections}"
)


def _get_fernet() -> Fernet:
    # Derive a valid 32-byte Fernet key from SECRET_KEY via SHA256
    derived = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_api_key(key: str) -> str:
    return _get_fernet().encrypt(key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


def _get_feature_attrs(user: User, feature: Feature | None) -> tuple[str | None, str | None, str | None]:
    """Return (base_url, api_key, model) for a feature, respecting override priority."""
    if feature is None:
        return user.ai_base_url, user.ai_api_key, user.ai_model
    return (
        getattr(user, f"{feature}_base_url") or user.ai_base_url,
        getattr(user, f"{feature}_api_key") or user.ai_api_key,
        getattr(user, f"{feature}_model") or user.ai_model,
    )


def get_user_llm_client(user: User, feature: Feature | None = None) -> AsyncOpenAI:
    """Create an OpenAI client from user's BYOK config or fall back to server defaults."""
    feature_base_url, feature_api_key, _ = _get_feature_attrs(user, feature)

    base_url = feature_base_url or settings.AI_DEFAULT_BASE_URL
    api_key: str
    if feature_api_key:
        api_key = decrypt_api_key(feature_api_key)
    elif settings.AI_DEFAULT_API_KEY:
        api_key = settings.AI_DEFAULT_API_KEY
    else:
        raise ValueError("No API key configured. Please set up AI configuration in settings.")

    return AsyncOpenAI(base_url=base_url, api_key=api_key)


def get_user_model(user: User, feature: Feature | None = None) -> str:
    _, _, feature_model = _get_feature_attrs(user, feature)
    return feature_model or settings.AI_DEFAULT_MODEL


async def generate_summary(client: AsyncOpenAI, model: str, title: str, content: str) -> str:
    """Generate article summary."""
    extracted = extract_content_for_summary(content, MAX_CONTENT_CHARS)
    user_message = f"Title: {title}\n\nContent:\n{extracted}"

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
    user_message = f"<title>{title}</title>\n\n<content>{truncated}</content>"

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

    # Try to extract from XML tags first
    title_match = re.search(r"<translated_title>(.*?)</translated_title>", result, re.DOTALL)
    content_match = re.search(r"<translated_content>(.*?)</translated_content>", result, re.DOTALL)
    if title_match and content_match:
        translated_title = title_match.group(1).strip()
        translated_content = content_match.group(1).strip()
    elif result.strip():
        # Fallback: split by blank line (title \\n\\n content)
        if "\n\n" in result:
            parts = result.split("\n\n", 1)
            if parts[0].strip() and parts[1].strip():
                translated_title = parts[0].strip()
                translated_content = parts[1].strip()
        elif "\n" in result:
            lines = result.split("\n", 1)
            if lines[0].strip() and len(lines) > 1 and lines[1].strip():
                translated_title = lines[0].strip()
                translated_content = lines[1].strip()

    return translated_title, translated_content


async def summarize_chat_history(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
) -> str:
    """Summarize older chat history into a brief paragraph."""
    conversation = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Summarize the following conversation in 2-3 sentences, preserving key topics and conclusions discussed. Write in the same language as the conversation."},
            {"role": "user", "content": conversation},
        ],
        temperature=0.3,
        max_tokens=300,
    )
    return response.choices[0].message.content or ""


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
    article_title: str | None = None,
    article_content: str | None = None,
    chat_history: list[dict] | None = None,
    new_message: str = "",
    history_summary: str | None = None,
    articles: list[dict] | None = None,
    images: list[str] | None = None,
) -> list[dict]:
    """Build messages list for chat API call.

    Supports two modes:
    1. Single article (legacy): pass article_title + article_content
    2. Multi-article (conversations): pass articles list of {"title": str, "content": str}
    """
    chat_history = chat_history or []

    if articles:
        # Build multi-article system prompt
        SEPARATOR_LEN = len("\n\n---\n\n")  # 8
        budget = MAX_CONTENT_CHARS
        sections: list[str] = []
        for article_data in articles:
            extracted = extract_content_for_summary(article_data["content"], MAX_CONTENT_CHARS)
            section = f"ARTICLE: {article_data['title']}\n\n{extracted}"
            cost = len(section) + (SEPARATOR_LEN if sections else 0)
            if cost <= budget:
                sections.append(section)
                budget -= cost
            elif budget > SEPARATOR_LEN:
                available = budget - SEPARATOR_LEN
                sections.append(section[:available])
                budget = 0
                break
            else:
                break
        article_sections = "\n\n---\n\n".join(sections)
        system_prompt = CHAT_MULTI_ARTICLE_SYSTEM_PROMPT.format(article_sections=article_sections)
    elif article_title and article_content:
        extracted = extract_content_for_summary(article_content, MAX_CONTENT_CHARS)
        system_prompt = CHAT_SYSTEM_PROMPT.format(article_content=extracted)
    else:
        system_prompt = "You are a helpful AI assistant. Use the same language as the user's question."

    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    if history_summary:
        messages.append({"role": "system", "content": f"Previous conversation summary:\n{history_summary}"})

    # Add recent chat history (last 6 turns / 12 messages)
    for msg in chat_history[-12:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Build user message — may include image attachments for vision
    if images:
        content_parts: list[dict] = [{"type": "text", "text": new_message}]
        for img_data in images:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": img_data},
            })
        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": new_message})
    return messages
