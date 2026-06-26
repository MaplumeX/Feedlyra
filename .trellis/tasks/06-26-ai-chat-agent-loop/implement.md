# Implement — AI Chat Agent Loop

## Ordered Checklist

### 1. 依赖 & schema
- [ ] `backend/pyproject.toml` 加 `jieba>=0.42` → `uv lock` 更新
- [ ] 新建 `backend/alembic/versions/016_chatmsg_tool_fields.py`：ChatMessage 加 `tool_calls`(JSON nullable) / `tool_call_id`(String nullable) / `name`(String nullable)；down_revision 015
- [ ] `backend/app/models/ai.py::ChatMessage` 同步加 3 个 Mapped 字段
- [ ] `alembic upgrade head` 验证；本地跑通

### 2. 检索升级（R4）
- [ ] `services/retrieval.py::_tokenize` 改用 jieba.cut；保留 STOPWORDS 过滤
- [ ] `tests/test_retrieval.py` 更新 19 条 expectations；新增"整句→实词命中"端到端用例（如 `'简单看看今天有什么文章'` 命中标题含 `今天` 的文章）
- [ ] `uv run python -m pytest tests/test_retrieval.py -q` 全绿

### 3. 工具定义（R2）
- [ ] 新建 `services/agent_tools.py`：
  - `TOOLS` schema 常量（search_articles / read_article）
  - `async def execute_tool(name, args, *, user_id, conversation_id, db) -> str`（JSON 字符串）
  - `search_articles` 调 `retrieve_relevant_articles`，返回 list[dict]
  - `read_article` 查 `Article` + 校验 `Feed.user_id`，写 `ConversationReference(is_auto=True)`（try 唯一约束冲突忽略）
- [ ] 单测：工具 schema 形状、execute_tool 路由、read_article 落库 ref

### 4. Agent loop 主循环（R1/R3/R6）
- [ ] 新建 `services/agent_loop.py`：
  - `async def run_agent_chat(...) -> AsyncIterator[str]`（yield SSE 事件 JSON 串）
  - 内部：messages 准备 → loop(max 8) → 流式 create(tools=tools or None, tool_choice="auto") → 解析 content 增量与 tool_calls delta 累积 → yield `{"content":...}` / `{"type":"tool_call_start",...}` / `{"type":"tool_call_end",...}` → 执行工具 → 持久化 ChatMessage(assistant/tool) → 收敛 `[DONE]`
  - 护栏：达 8 轮注入 system 提示后无 tools 最后一轮
- [ ] `services/llm.py` 新增 `stream_chat_with_tools`：把 `client.chat.completions.create(stream=True, tools=..., tool_choice=...)` 的 chunk 流解析成 `(content_delta: str | None, tool_calls_delta: list | None)` 元组流
- [ ] 单测（纯逻辑）：tool_calls delta 累积（多片 arguments 拼接）、护栏 8 轮截断注入、空 tools 不崩

### 5. router 接线（R7/R8/R9）
- [ ] `routers/ai.py::_do_conversation_chat`：
  - 移除原"静默 auto-retrieval + build_chat_messages 多文章 prompt"分支
  - 调 `run_agent_chat`，把它的 SSE 事件流直接 `StreamingResponse` 透传
  - `ai_cross_article_search=false` → tools=[]（loop 内自然 1 轮）
  - try/except 包裹：异常降级为现 `stream_chat` 无 tools 路径
- [ ] legacy `/articles/{id}/chat` 与新 endpoint 都走同一函数（已共用，确认不退化）

### 6. 前端 SSE 事件渲染（R3）
- [ ] 浮动 chat 组件：解析 `tool_call_start` / `tool_call_end`，渲染"正在搜索 {args.query} … 找到 N 篇 / 正在阅读《title》"行
- [ ] 旧 `content` 流处理不变

## Validation Commands

```bash
cd backend
uv run python -m pytest tests/test_retrieval.py -q        # R4
uv run python -m pytest tests/test_agent_tools.py -q      # R2（新增）
uv run python -m pytest tests/test_agent_loop.py -q       # R1/R6（新增）
uv run python -m pytest tests/ -q                          # 全量不回归
alembic upgrade head                                        # migration 016
```

## 风险点 / 回滚

- **流式 tool_calls delta 累积**：OpenAI 协议里同一 tool_call 的 arguments 跨多个 chunk，按 `index` 拼接；id/function_name 只在首片。→ 单测重点覆盖。
- **jieba 首次加载延迟**：~0.5s 字典加载，可预热；首条 chat 略慢可接受。
- **tool 消息落库 IO**：每轮 2 条写（assistant+tool），8 轮上限 16 条写；可接受。
- **回滚**：每步独立提交；revert migration 016 + router 改动即回退原路径（原 stream_chat 保留未删）。

## Follow-up Before task.py start

- [ ] 用户 review prd.md / design.md / implement.md
- [ ] 视情况 curate `implement.jsonl` / `check.jsonl` spec 清单
