from __future__ import annotations

import json
from uuid import uuid4

import pytest

from app.services.agent_tools import TOOLS, execute_tool, _TOOL_NAMES


# ---------------------------------------------------------------------------
# Tool schema shape tests
# ---------------------------------------------------------------------------


class TestToolSchema:
    def test_three_tools_exposed(self) -> None:
        names = {t["function"]["name"] for t in TOOLS}
        assert names == {"search_articles", "list_articles", "read_article"}

    def test_each_tool_is_function_type(self) -> None:
        for t in TOOLS:
            assert t["type"] == "function"
            assert "name" in t["function"]
            assert "description" in t["function"]
            assert "parameters" in t["function"]

    def test_search_articles_requires_query(self) -> None:
        fn = next(t["function"] for t in TOOLS if t["function"]["name"] == "search_articles")
        params = fn["parameters"]
        assert params["type"] == "object"
        assert "query" in params["properties"]
        assert params["required"] == ["query"]

    def test_list_articles_has_filter_params_none_required(self) -> None:
        fn = next(t["function"] for t in TOOLS if t["function"]["name"] == "list_articles")
        params = fn["parameters"]
        assert params["type"] == "object"
        assert set(params["properties"].keys()) == {"days", "feed_id", "unread_only", "limit"}
        # All list_articles params are optional — defaults are sensible for a
        # bare "今天有什么文章" call.
        assert params["required"] == []
        assert params["properties"]["days"]["type"] == "integer"
        assert params["properties"]["feed_id"]["type"] == "string"
        assert params["properties"]["unread_only"]["type"] == "boolean"
        assert params["properties"]["limit"]["type"] == "integer"

    def test_read_article_requires_article_id(self) -> None:
        fn = next(t["function"] for t in TOOLS if t["function"]["name"] == "read_article")
        params = fn["parameters"]
        assert params["type"] == "object"
        assert "article_id" in params["properties"]
        assert params["required"] == ["article_id"]

    def test_descriptions_are_chinese_and_action_oriented(self) -> None:
        # Descriptions drive model tool selection; ensure they hint at purpose.
        for t in TOOLS:
            desc = t["function"]["description"]
            assert len(desc) > 10
            # Must mention what it does (search / list / read full text)
            assert any(k in desc for k in ("搜索", "列出", "拉取"))


# ---------------------------------------------------------------------------
# execute_tool routing tests — pure logic, no DB
# ---------------------------------------------------------------------------


class TestExecuteToolRouting:
    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error_content(self) -> None:
        result = await execute_tool(
            "not_a_real_tool",
            {},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]  # never reached: bails on name
        )
        parsed = json.loads(result.content)
        assert "error" in parsed
        assert "unknown tool" in parsed["error"]
        assert "not_a_real_tool" in result.summary

    @pytest.mark.asyncio
    async def test_search_articles_missing_query_returns_error(self) -> None:
        result = await execute_tool(
            "search_articles",
            {},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]  # bails before DB use
        )
        parsed = json.loads(result.content)
        assert parsed["error"] == "missing query"

    @pytest.mark.asyncio
    async def test_search_articles_empty_query_returns_error(self) -> None:
        result = await execute_tool(
            "search_articles",
            {"query": "   "},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]
        )
        parsed = json.loads(result.content)
        assert parsed["error"] == "missing query"

    @pytest.mark.asyncio
    async def test_read_article_missing_id_returns_error(self) -> None:
        result = await execute_tool(
            "read_article",
            {},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]
        )
        parsed = json.loads(result.content)
        assert parsed["error"] == "missing article_id"

    @pytest.mark.asyncio
    async def test_read_article_invalid_uuid_returns_error(self) -> None:
        result = await execute_tool(
            "read_article",
            {"article_id": "not-a-uuid"},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]  # bails on parse before DB
        )
        parsed = json.loads(result.content)
        assert parsed["error"] == "invalid article_id"
        assert parsed["article_id"] == "not-a-uuid"
        assert "无效" in result.summary

    @pytest.mark.asyncio
    async def test_search_articles_no_tokens_returns_empty_without_db(self) -> None:
        # A query that tokenizes to nothing (only punctuation/stopwords) must
        # bail before touching the DB — so db=None must not raise.
        result = await execute_tool(
            "search_articles",
            {"query": "!!! ??? ..."},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]  # token check bails first
        )
        parsed = json.loads(result.content)
        assert parsed["count"] == 0
        assert parsed["results"] == []

    @pytest.mark.asyncio
    async def test_list_articles_invalid_feed_id_returns_error_without_db(self) -> None:
        # Invalid feed_id UUID bails before any query — db=None must not raise.
        result = await execute_tool(
            "list_articles",
            {"feed_id": "not-a-uuid"},
            user_id=uuid4(),
            conversation_id=uuid4(),
            db=None,  # type: ignore[arg-type]  # UUID parse bails first
        )
        parsed = json.loads(result.content)
        assert parsed["error"] == "invalid feed_id"
        assert parsed["feed_id"] == "not-a-uuid"
        assert "无效" in result.summary


class TestToolResultShape:
    def test_tool_result_holds_content_and_summary(self) -> None:
        from app.services.agent_tools import ToolResult

        tr = ToolResult(content='{"ok": true}', summary="ok")
        assert tr.content == '{"ok": true}'
        assert tr.summary == "ok"
