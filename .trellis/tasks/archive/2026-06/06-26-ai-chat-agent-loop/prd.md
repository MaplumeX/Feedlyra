# Reshape cross-article chat into an agentic tool-calling experience

## Goal

把现有的"无引用时静默关键词检索 → 拼进 system prompt"路径，重设计成一个真正的 LLM agent loop：模型通过工具调用（tool calling）自主决定何时搜索、搜什么、是否换关键词重搜、是否精读某篇，最终基于真实订阅源内容回答；工具调用过程对用户可见。

## User Value

- 修掉现状的硬伤：`_tokenize` 把中文整句切成单块导致零命中，6-25 那次"简单看看今天有什么文章"结果 0 引用，LLM 只能回"无法访问互联网"。
- 让 AI 真正能"读订阅源回答"，而不是靠一次性静态拼文章摘要。
- 推理过程可见，用户能确认 AI 在搜什么、找到什么。

## Confirmed Facts（来自代码 / 数据库 inspection）

- 现有 chat 入口：`POST /conversations/{id}/chat` 与 legacy `POST /articles/{id}/chat`，共享 `_do_conversation_chat`（routers/ai.py:1114）。
- 现有流式实现：`stream_chat`（services/llm.py:197）是纯 content 流式，未携带 tools，直接调 `client.chat.completions.create(stream=True)`。
- prompt 构造：`build_chat_messages`（llm.py:219）把已引用文章据 `readable_content` 静态拼成 `CHAT_MULTI_ARTICLE_SYSTEM_PROMPT`。
- 现有检索：`services/retrieval.py::retrieve_relevant_articles` 关键词 ILIKE，CJK 整句分词 bug 已确认。
- 用户开关 `users.ai_cross_article_search` 已存在，migration 015 已应用，alembic head=015；3 个用户均默认 true。
- 现有 SSE 事件只有 `{"content": chunk}` 和最后的 `[DONE]`。
- `ConversationReference` 有 `is_auto` 字段；线上 21 条 auto refs 全是 legacy 文章会话塞的单条，新批量检索特征（一次多条）出现 0 次。
- LLM client 通过 `get_user_llm_client(user, "chat")` 得到 `AsyncOpenAI` 的兼容实例；`get_user_model(user, "chat")` 得到模型名。

## Requirements

### 功能
- R1 真 agent loop：模型输出 tool_call → 后端执行 tool → 结果作为 tool message 回喂 → 模型继续（可再 tool_call 或最终回答）→ 收敛。支持多轮、换 query 重搜。
- R2 Tool suite（MVP 两个）：
  - `search_articles(query)`：在用户订阅源内检索文章，返回候选列表（id/title/摘要片段/相关度信号）。
  - `read_article(article_id)`：拉取指定文章的全文（`readable_content`），供精读回答。
- R3 工具调用过程可见：通过现有 SSE 通道下发新事件类型（`tool_call_start` / `tool_call_end` 等），前端展示"正在搜索 X … 找到 N 篇"。
- R4 检索能力同步升级：改用 jieba 中文分词替换 `_tokenize` 的 CJK 整句切块，保证自然语言问句可命中标题/摘要实词。
- R5 工具在后端进程内直接执行，不走额外 HTTP。
- R6 护栏：每条 chat 路径最大工具调用轮数 8；达到上限时优雅收敛（注入 system 提示让模型基于已有信息回答），不硬报错。

### 兼容 / 非功能性
- R7 前端开关仍由 `ai_cross_article_search` 控制；关闭时 agent loop 框架仍在，但不向模型暴露 search_articles / read_article 工具（tools 列表为空，等价于一次无工具 LLM 调用）。
- R8 agent loop 失败必须降级为原"无引用回复"，不阻断 chat。
- R9 legacy `/articles/{id}/chat` 与新 `/conversations/{id}/chat` 共用同一 agent 化逻辑。

## Acceptance Criteria

- [ ] AC1 用户问自然语言整句（如"简单看看今天有什么文章""订阅源里关于 AI 的"），agent 能成功发起 ≥1 次 `search_articles` 并命中候选文章，最终回复包含订阅源真实内容/标题。
- [ ] AC2 Agent 可在第一轮搜不到时换关键词重搜（多轮 tool_call），单次 chat 达到最终回答累计 tool_call 数 ≤ 护栏上限。
- [ ] AC3 工具调用过程通过 SSE 可见，前端渲染"正在搜索 / 找到 N 篇 / 正在阅读《X》"。
- [ ] AC4 `read_article` 能拉全文，模型基于全文回答而非仅摘要。
- [ ] AC5 关闭 `ai_cross_article_search` 时：agent loop 仍在但 tools 列表为空，chat 正常工作不崩、模型不会尝试搜索文章。
- [ ] AC6 现有单元测试不回归；新增 agent loop 与工具定义的测试覆盖（纯逻辑：工具 schema、循环收敛、护栏截断）。
- [ ] AC7 SSE 向后兼容：旧客户端忽略未知事件仍能正常显示 content 流。

## Out of Scope

- WebSocket 双向通道（Q4 已定复用 SSE）。
- 工具调用的外部 HTTP 化（Q5 已定进程内）。
- 工具集超过 search_articles / read_article（Q2 MVP 两个；translate/list_feeds 等后续迭代）。
- 非 chat 场景（摘要、翻译）的 agent 化。

## Open Questions（进入 brainstorm 阶段细化）

- 检索方法：已定 (A) 关键词 + jieba 分词（新依赖 jieba）。不再走旧 `_tokenize` 整句 bug 路径。
- `ai_cross_article_search=false` 时的降级语义：已定 (b) agent loop 框架仍在，但不向模型暴露 search/read 工具。
- 护栏上限具体数值：已定 8 轮。
- ConversationReference 与工具调用过程的关系：已定 (β) 扩展 ChatMessage 存工具消息（加 tool_calls/tool_call_id/name 可空字段，user/assistant/tool 三种 role 全落库，历史可回放）；`read_article` 调用过的文章写 `is_auto=True` 的 ConversationReference（语义从"预置参考"演变为"agent 引用过的"），search_articles 候选不入库。原"无引用时静默塞 auto ref"路径删除。
- Agent 用到的 system prompt / tool schema 边界：进入 design.md 阶段细化。
