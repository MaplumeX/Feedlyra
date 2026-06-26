"""Agent loop: model decides when to search/read via tool calls.

run_agent_chat yields SSE event strings to be streamed back to the client.
The router wraps this in a StreamingResponse.

Event protocol (backward-compatible with the old {content: chunk} / [DONE]):
  - {"content": "..."}              — streamed answer text
  - {"type":"tool_call_start",...}  — agent is invoking a tool
  - {"type":"tool_call_end",...}    — tool finished, with a short summary
  - data: [DONE]                    — end of stream
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import async_session
from app.models.ai import ChatMessage, Conversation
from app.models.user import User
from app.services.agent_tools import TOOLS, ToolResult, execute_tool
from app.services.llm import (
    ToolCallAccumulated,
    get_user_llm_client,
    get_user_model,
    stream_chat,
    stream_chat_with_tools,
    summarize_chat_history,
)

logger = logging.getLogger(__name__)

# Guard rail (R6): a single chat may issue at most this many tool-call rounds
# before we force the model to answer from what it already has.
MAX_TOOL_ROUNDS = 8

# History trimming mirrors the pre-agent chat path: keep this many recent
# turn-pairs verbatim, summarize anything older once it crosses the threshold.
HISTORY_FULL_TURNS = 6
SUMMARY_THRESHOLD = 8

# When tools are exposed (R7 on), instruct the model to actually search the
# subscription feed rather than claiming it can't access the internet — the
# whole point of the agent loop. When tools are NOT exposed (R7 off), we must
# NOT mention the tools: the model has no way to call them, and prompting it
# to do so produces apologetic "I would search but I can't" answers (R7:
# "模型不会尝试搜索文章").
_AGENT_SYSTEM_PROMPT_WITH_TOOLS = (
    "You are an AI assistant helping a user with their RSS article subscriptions. "
    "When the user asks about articles, topics, or their feed contents, use the "
    "search_articles and read_article tools to look up real articles in their "
    "subscriptions before answering — never claim you cannot access their feed. "
    "If a search returns nothing useful, try a different keyword before giving up. "
    "Answer in the user's language. When you reference an article, quote or "
    "summarize real content from it."
)
_AGENT_SYSTEM_PROMPT_NO_TOOLS = (
    "You are an AI assistant helping a user with their RSS article subscriptions. "
    "Answer in the user's language. Be concise and helpful."
)


def _system_prompt(tools_enabled: bool) -> str:
    return _AGENT_SYSTEM_PROMPT_WITH_TOOLS if tools_enabled else _AGENT_SYSTEM_PROMPT_NO_TOOLS

# System nudge injected when the tool-call guard rail trips.
RAIL_LIMIT_SYSTEM = "已达工具调用上限，请基于已获取信息回答本条消息。"


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _history_to_messages(history: list[ChatMessage]) -> list[dict]:
    """Rebuild OpenAI messages from persisted ChatMessage rows.

    Tool exchanges replay in full: assistant messages carry tool_calls, tool
    messages carry tool_call_id + name + content. Replaying them gives the
    model context of what it already searched without rerunning the tools.
    """
    msgs: list[dict] = []
    for m in history:
        msg: dict = {"role": m.role, "content": m.content or ""}
        if m.tool_calls is not None:
            msg["tool_calls"] = m.tool_calls
            # Assistant messages that发起 tool calls have empty content; OpenAI
            # accepts null content for assistant tool_call messages.
            if not msg["content"]:
                msg["content"] = None
        if m.tool_call_id is not None:
            msg["tool_call_id"] = m.tool_call_id
        if m.name is not None:
            msg["name"] = m.name
        msgs.append(msg)
    return msgs


async def _prepare_messages(
    conv: Conversation,
    user_message: str,
    user_msg_id: UUID,
    db: AsyncSession,
    images: list[str] | None,
) -> list[dict]:
    """Load persisted history (excluding the just-stored user msg) and build
    the OpenAI messages array for the agent loop.

    Carries the history-summary + trimming logic from the original path,
    expanded to replay assistant tool_calls / tool messages.

    `conv` may be detached from `db` (the loop uses its own session), so we
    re-fetch it together with its user here rather than touching detached
    relationships.
    """
    from app.models.ai import Conversation as _Conversation

    conv_fresh = await db.get(_Conversation, conv.id)
    if conv_fresh is None:
        # Shouldn't happen — the router already validated ownership. Fall back
        # to the detached object for id/history_summary reads.
        conv_fresh = conv
    conv_user = await db.get(User, conv_fresh.user_id)

    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
    )
    history_msgs = [m for m in history_result.scalars().all() if m.id != user_msg_id]
    history_dicts = _history_to_messages(history_msgs)

    history_summary = conv_fresh.history_summary
    if len(history_dicts) > SUMMARY_THRESHOLD * 2:
        older = history_dicts[: -HISTORY_FULL_TURNS * 2]
        recent = history_dicts[-HISTORY_FULL_TURNS * 2:]
        if not history_summary and older:
            try:
                client = get_user_llm_client(conv_user, "chat")  # type: ignore[arg-type]
                model = get_user_model(conv_user, "chat")  # type: ignore[arg-type]
                history_summary = await summarize_chat_history(client, model, older)
                conv_fresh.history_summary = history_summary
                await db.commit()
            except Exception:
                logger.warning("Failed to summarize chat history, proceeding without summary")
        history_dicts = recent

    # Mirror the router's tool-exposure gate: only mention tools when they're
    # actually available to the model this turn (R7).
    tools_enabled = bool(getattr(conv_user, "ai_cross_article_search", True))
    messages: list[dict] = [{"role": "system", "content": _system_prompt(tools_enabled)}]
    if history_summary:
        messages.append(
            {"role": "system", "content": f"Previous conversation summary:\n{history_summary}"}
        )
    messages.extend(history_dicts)

    if images:
        content_parts: list[dict] = [{"type": "text", "text": user_message}]
        for img_data in images:
            content_parts.append({"type": "image_url", "image_url": {"url": img_data}})
        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": user_message})
    return messages


async def _accumulate_round(
    stream: AsyncIterator[tuple[str | None, dict | None]],
) -> tuple[list[str], list[ToolCallAccumulated]]:
    """Consume one streaming completion, accumulating content and tool_calls.

    OpenAI streams tool_calls as fragments: the first chunk carries id +
    function.name, subsequent chunks append to function.arguments. We
    accumulate by `index` and return complete tool_calls sorted by index.
    """
    content_chunks: list[str] = []
    acc: dict[int, ToolCallAccumulated] = {}

    async for content, frag in stream:
        if content:
            content_chunks.append(content)
        if frag is None:
            continue
        idx = frag["index"]
        tc = acc.setdefault(idx, ToolCallAccumulated(index=idx))
        if "id" in frag:
            tc.id = frag["id"]
        if "name" in frag:
            tc.name = frag["name"]
        if "arguments_delta" in frag:
            tc.arguments += frag["arguments_delta"]

    return content_chunks, [acc[i] for i in sorted(acc)]


def _safe_json(raw: str) -> dict | str:
    """Best-effort parse of a tool_call's arguments JSON.

    Falls back to the raw string if the model produced malformed JSON, so the
    frontend still has something to show and tool routing degrades safely.
    """
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return raw


async def _run_one_tool(
    tc: ToolCallAccumulated, user: User, conv_id: UUID, db: AsyncSession
) -> ToolResult:
    args = _safe_json(tc.arguments)
    if not isinstance(args, dict):
        args = {}
    try:
        return await execute_tool(
            tc.name, args, user_id=user.id, conversation_id=conv_id, db=db
        )
    except Exception as e:
        logger.exception("Tool execution failed: %s", tc.name)
        return ToolResult(
            content=json.dumps({"error": str(e)}, ensure_ascii=False),
            summary=f"{tc.name} 执行失败",
        )


async def _persist_assistant(
    db: AsyncSession,
    conv_id: UUID,
    content: str,
    *,
    tool_calls: list[dict] | None,
) -> None:
    db.add(
        ChatMessage(
            conversation_id=conv_id,
            role="assistant",
            content=content,
            tool_calls=tool_calls,
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()


async def _persist_tool_message(
    db: AsyncSession,
    conv_id: UUID,
    tool_call_id: str,
    name: str,
    content: str,
) -> None:
    db.add(
        ChatMessage(
            conversation_id=conv_id,
            role="tool",
            content=content,
            tool_call_id=tool_call_id,
            name=name,
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()


async def _final_plain_round(
    client,
    model,
    messages: list[dict],
    db: AsyncSession,
    conv_id: UUID,
    full_response_parts: list[str],
) -> AsyncIterator[str]:
    """One plain (no-tools) streaming round, used at guard-rail limit or when
    tools are disabled."""
    parts: list[str] = []
    async for chunk in stream_chat(client, model, messages):
        parts.append(chunk)
        full_response_parts.append(chunk)
        yield _sse({"content": chunk})
    await _persist_assistant(db, conv_id, "".join(parts), tool_calls=None)


async def _plain_fallback(
    client,
    model,
    conv: Conversation,
    user_message: str,
    user_msg_id: UUID,
    images: list[str] | None,
    db: AsyncSession,
) -> AsyncIterator[str]:
    """Build a no-tools message list (best-effort) and stream a plain answer.

    Used when the agent loop raises and we must not break the chat (R8).
    """
    try:
        messages = await _prepare_messages(conv, user_message, user_msg_id, db, images)
    except Exception:
        logger.exception("Fallback message prep failed; sending minimal context")
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_message},
        ]
    parts: list[str] = []
    async for chunk in stream_chat(client, model, messages):
        parts.append(chunk)
        yield _sse({"content": chunk})
    await _persist_assistant(db, conv.id, "".join(parts), tool_calls=None)


async def run_agent_chat(
    conv: Conversation,
    user: User,
    user_message: str,
    user_msg_id: UUID,
    images: list[str] | None,
) -> AsyncIterator[str]:
    """Run the agent loop, yielding SSE event strings.

    Falls back to a plain no-tools stream_chat on any unexpected error so the
    chat never breaks (R8).

    Owns its own DB session: the streaming generator outlives the request-scoped
    session (FastAPI closes get_db's session once the StreamingResponse is
    returned), so we must hold a fresh session for the whole loop.
    """
    try:
        client = get_user_llm_client(user, "chat")
    except ValueError as e:
        yield _sse({"error": str(e)})
        yield "data: [DONE]\n\n"
        return

    model = get_user_model(user, "chat")
    tools = TOOLS if getattr(user, "ai_cross_article_search", True) else []

    async with async_session() as db:
        try:
            messages = await _prepare_messages(conv, user_message, user_msg_id, db, images)
        except Exception:
            logger.exception("Failed to prepare agent messages; degrading to plain chat")
            async for evt in _plain_fallback(client, model, conv, user_message, user_msg_id, images, db):
                yield evt
            return

        full_response_parts: list[str] = []

        try:
            rounds = 0
            while True:
                # Guard rail: at the cap, force a final no-tools answer.
                if rounds >= MAX_TOOL_ROUNDS:
                    messages.append({"role": "system", "content": RAIL_LIMIT_SYSTEM})
                    async for evt in _final_plain_round(client, model, messages, db, conv.id, full_response_parts):
                        yield evt
                    break

                content_chunks, tool_calls = await _accumulate_round(
                    stream_chat_with_tools(client, model, messages, tools=tools or None)
                )
                for c in content_chunks:
                    full_response_parts.append(c)
                    yield _sse({"content": c})

                if not tool_calls:
                    # Pure content round → this is the model's final answer.
                    await _persist_assistant(
                        db, conv.id, "".join(content_chunks), tool_calls=None
                    )
                    break

                # Tool calls: persist the assistant tool_call message, run each
                # tool, emit SSE events, and feed results back as tool messages.
                assistant_tool_calls = [tc.to_openai_dict() for tc in tool_calls]
                await _persist_assistant(
                    db, conv.id, "".join(content_chunks), tool_calls=assistant_tool_calls
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": "".join(content_chunks) or None,
                        "tool_calls": assistant_tool_calls,
                    }
                )

                for tc in tool_calls:
                    yield _sse(
                        {"type": "tool_call_start", "name": tc.name, "args": _safe_json(tc.arguments)}
                    )
                    tool_result = await _run_one_tool(tc, user, conv.id, db)
                    yield _sse(
                        {
                            "type": "tool_call_end",
                            "name": tc.name,
                            "result_summary": tool_result.summary,
                        }
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": tc.name,
                            "content": tool_result.content,
                        }
                    )
                    await _persist_tool_message(
                        db, conv.id, tc.id, tc.name, tool_result.content
                    )

                rounds += 1
        except Exception:
            logger.exception("Agent loop failed; degrading to plain chat")
            if full_response_parts:
                # Already streamed partial content; just end gracefully.
                yield "data: [DONE]\n\n"
                return
            async for evt in _plain_fallback(client, model, conv, user_message, user_msg_id, images, db):
                yield evt
            return

    yield "data: [DONE]\n\n"
