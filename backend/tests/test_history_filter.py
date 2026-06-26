from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models.ai import ChatMessage
from app.routers.ai import _is_displayed


def _msg(role: str, *, content: str = "", tool_calls=None, tool_call_id=None, name=None) -> ChatMessage:
    return ChatMessage(
        id=uuid4(),
        conversation_id=uuid4(),
        role=role,
        content=content,
        tool_calls=tool_calls,
        tool_call_id=tool_call_id,
        name=name,
        created_at=datetime.now(timezone.utc),
    )


class TestIsDisplayed:
    def test_user_message_displayed(self) -> None:
        assert _is_displayed(_msg("user", content="hi")) is True

    def test_final_assistant_answer_displayed(self) -> None:
        # Assistant turn that produced a final answer (no tool_calls) is the
        # bubble the user should see on reload.
        assert _is_displayed(_msg("assistant", content="here is the answer")) is True

    def test_tool_message_hidden(self) -> None:
        # Raw tool results are persisted only for LLM history replay; showing
        # them would surface raw JSON as a user-style bubble (design option beta).
        assert _is_displayed(
            _msg("tool", content='{"results":[]}', tool_call_id="c1", name="search_articles")
        ) is False

    def test_assistant_tool_call_intermediate_hidden(self) -> None:
        # An assistant turn that only issued tool_calls (no final answer yet)
        # must not render as an empty bubble on history reload.
        assert _is_displayed(
            _msg("assistant", content="", tool_calls=[{"id": "c1", "type": "function"}])
        ) is False

    def test_assistant_with_preamble_and_tool_calls_hidden(self) -> None:
        # Even when the model streamed a preamble ("Let me search...") before a
        # tool call, drop it from the UI history; the final answer carries the
        # substance, and a stray preamble bubble would look broken.
        assert _is_displayed(
            _msg("assistant", content="Let me search", tool_calls=[{"id": "c1"}])
        ) is False
