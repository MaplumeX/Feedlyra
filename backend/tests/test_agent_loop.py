from __future__ import annotations

import json
from uuid import uuid4

import pytest

from app.services.agent_loop import (
    MAX_TOOL_ROUNDS,
    RAIL_LIMIT_SYSTEM,
    _AGENT_SYSTEM_PROMPT,
    _accumulate_round,
    _safe_json,
)
from app.services.llm import ToolCallAccumulated


# ---------------------------------------------------------------------------
# Tool-call delta accumulation (design.md §Trade-offs — biggest pitfall)
# ---------------------------------------------------------------------------


async def _stream(items):
    """Translate a list of (content, frag) tuples into an async iterator."""
    for content, frag in items:
        yield content, frag


class TestAccumulateRound:
    @pytest.mark.asyncio
    async def test_pure_content_round(self) -> None:
        items = [
            ("Hello", None),
            (", world", None),
            (None, None),
        ]
        content, tool_calls = await _accumulate_round(_stream(items))
        assert content == ["Hello", ", world"]
        assert tool_calls == []

    @pytest.mark.asyncio
    async def test_arguments_accumulated_across_fragments(self) -> None:
        # The core OpenAI streaming pitfall: one tool_call split across chunks.
        # First fragment carries id+name; follow-ups append arguments JSON.
        items = [
            (None, {"index": 0, "id": "call_1", "name": "search_articles"}),
            (None, {"index": 0, "arguments_delta": '{"quer'}),
            (None, {"index": 0, "arguments_delta": 'y":"AI"}'}),
        ]
        _, tool_calls = await _accumulate_round(_stream(items))
        assert len(tool_calls) == 1
        tc = tool_calls[0]
        assert tc.index == 0
        assert tc.id == "call_1"
        assert tc.name == "search_articles"
        assert tc.arguments == '{"query":"AI"}'

    @pytest.mark.asyncio
    async def test_multiple_tool_calls_indexed(self) -> None:
        # Two tool calls interleaved by index — must be sorted by index at end.
        items = [
            (None, {"index": 0, "id": "c0", "name": "search_articles", "arguments_delta": '{"query":"a"}'}),
            (None, {"index": 1, "id": "c1", "name": "read_article", "arguments_delta": '{"article_id":"x"}'}),
        ]
        _, tool_calls = await _accumulate_round(_stream(items))
        assert [t.id for t in tool_calls] == ["c0", "c1"]
        assert [t.name for t in tool_calls] == ["search_articles", "read_article"]

    @pytest.mark.asyncio
    async def test_content_and_tool_calls_interleaved(self) -> None:
        # The model may stream some text before deciding to call a tool.
        items = [
            ("Let me search ", None),
            (None, {"index": 0, "id": "c0", "name": "search_articles", "arguments_delta": '{"query":"AI"}'}),
        ]
        content, tool_calls = await _accumulate_round(_stream(items))
        assert content == ["Let me search "]
        assert len(tool_calls) == 1
        assert tool_calls[0].arguments == '{"query":"AI"}'

    @pytest.mark.asyncio
    async def test_empty_stream(self) -> None:
        content, tool_calls = await _accumulate_round(_stream([]))
        assert content == []
        assert tool_calls == []

    @pytest.mark.asyncio
    async def test_to_openai_dict_shape(self) -> None:
        tc = ToolCallAccumulated(index=0, id="call_9", name="read_article", arguments='{"article_id":"abc"}')
        d = tc.to_openai_dict()
        assert d == {
            "id": "call_9",
            "type": "function",
            "function": {"name": "read_article", "arguments": '{"article_id":"abc"}'},
        }


# ---------------------------------------------------------------------------
# Guard rail
# ---------------------------------------------------------------------------


class TestGuardRail:
    def test_max_rounds_is_eight(self) -> None:
        # Design froze the guard rail at 8 rounds (brainstorm Q3).
        assert MAX_TOOL_ROUNDS == 8

    def test_rail_limit_message_mentions_upper_limit(self) -> None:
        # When the rail trips, we inject this as a system message. It must tell
        # the model to answer from what it already has, not to keep calling tools.
        assert "上限" in RAIL_LIMIT_SYSTEM or "已经" in RAIL_LIMIT_SYSTEM
        assert "回答" in RAIL_LIMIT_SYSTEM


class TestSystemPrompt:
    def test_prompt_mentions_all_three_tools(self) -> None:
        # Tools are always exposed now (the ai_cross_article_search toggle was
        # removed). The system prompt must name all three tools so the model
        # actually uses them instead of claiming it cannot access the feed,
        # and picks the right one by question type.
        assert "search_articles" in _AGENT_SYSTEM_PROMPT
        assert "list_articles" in _AGENT_SYSTEM_PROMPT
        assert "read_article" in _AGENT_SYSTEM_PROMPT

    def test_prompt_guides_tool_selection_by_question_type(self) -> None:
        # list_articles is for list/filter questions; keyword search is not.
        # The prompt must steer the model away from keyword search for those.
        assert "list_articles" in _AGENT_SYSTEM_PROMPT
        assert "今天有什么文章" in _AGENT_SYSTEM_PROMPT or "filter" in _AGENT_SYSTEM_PROMPT.lower()


# ---------------------------------------------------------------------------
# Empty tools (R7/R8) — _safe_json must not crash on malformed model output
# ---------------------------------------------------------------------------


class TestSafeJson:
    def test_empty_string_returns_empty_dict(self) -> None:
        assert _safe_json("") == {}

    def test_valid_json_parsed(self) -> None:
        assert _safe_json('{"query":"AI"}') == {"query": "AI"}

    def test_malformed_json_falls_back_to_raw(self) -> None:
        # The model can produce partial/malformed args mid-stream; _safe_json
        # must never raise — agent routing treats non-dict as empty args.
        raw = "{not closed"
        result = _safe_json(raw)
        assert result == raw

    def test_malformed_then_used_as_empty_args(self) -> None:
        # The consumer (_run_one_tool) treats non-dict safe_json results as {}.
        result = _safe_json("{broken")
        assert not isinstance(result, dict)  # surfaces as raw string
