# Design — AI Chat Agent Loop

## Architecture & Boundaries

### 改造范围

把 `_do_conversation_chat`（routers/ai.py:1114）从"一次性流式 + 静态拼文章 prompt"改造成一个 agent loop。
新逻辑落在 `services/agent_loop.py`（新建），routers 只负责 HTTP/SSE 包装。

核心契约：

```
routers/ai.py::_do_conversation_chat
  └─> services/agent_loop.py::run_agent_chat(conv, user, user_message, db) -> AsyncIterator[SSEEvent]
        ├─ 准备 system prompt + history（来自已落库 ChatMessage，含历史 tool 消息）
        ├─ build tools list（受 user.ai_cross_article_search 控制）
        ├─ loop (max 8 轮):
        │     1. client.chat.completions.create(stream=True, tools=..., tool_choice="auto")
        │     2. 解析流式 chunk：累积 content 与 tool_calls
        │     3. 若有 tool_calls：
        │          a) yield tool_call_start 事件（前端可见）
        │          b) 进程内执行工具
        │          c) 把 assistant tool_call + tool result 追加进 messages
        │          d) 落库 ChatMessage(role=assistant/tool)
        │          e) yield tool_call_end 事件
        │          f) continue 下一轮
        │     否则（纯 content，无 tool_call）：流式 yield content，break
        └─ 收敛：yield [DONE]
```

### 模块边界

| 模块 | 职责 | 改动 |
|---|---|---|
| `services/agent_loop.py` | agent loop 主循环、工具执行、SSE 事件生成 | **新建** |
| `services/agent_tools.py` | tool schema 定义 + 进程内工具实现 | **新建** |
| `services/llm.py` | `stream_chat` 保留为无工具 fallback；新增 `stream_chat_with_tools`（流式 + tool_calls 累积解析） | 改 |
| `services/retrieval.py` | `_tokenize` 换 jieba；`retrieve_relevant_articles` 契约不变 | 改 |
| `routers/ai.py::_do_conversation_chat` | 改为调用 `run_agent_chat`，移除原"静默 auto-retrieval + 拼多文章 prompt"分支 | 改 |
| `models/ai.py::ChatMessage` | 加 `tool_calls`(JSON) / `tool_call_id` / `name` 可空字段 | 改 |
| `migration 016` | ChatMessage 加三列 | 新建 |

## Data Flow & Contracts

### Tool Schema（MVP 两个）

```python
TOOLS = [
  {
    "type": "function",
    "function": {
      "name": "search_articles",
      "description": "在用户已订阅的文章源内按关键词搜索。用户问及某话题/某期内容/想看文章时调用。",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {"type": "string", "description": "搜索关键词，从用户问题提炼实词"}
        },
        "required": ["query"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "read_article",
      "description": "拉取某篇文章的全文，用于基于全文精读回答。需先 search_articles 拿到 article_id。",
      "parameters": {
        "type": "object",
        "properties": {
          "article_id": {"type": "string", "description": "search_articles 返回的候选 id"}
        },
        "required": ["article_id"]
      }
    }
  }
]
```

### 工具实现契约（services/agent_tools.py）

| 工具 | 签名 | 返回 | 落库副作用 |
|---|---|---|---|
| `search_articles(query, user_id, db)` | 异步 | `list[{id,title,summary_snippet(≤200字)}]` 截断 limit=5，7 天窗口 | 无（候选不入库） |
| `read_article(article_id, user_id, db, conversation_id)` | 异步 | `{id,title,readable_content}` 正文 | 写一条 `ConversationReference(conversation_id, article_id, is_auto=True)`（去重，唯一约束保护） |

返回给模型的 JSON 字符串——LLM tool 协议要求 tool message content 是 string。

### SSE 事件协议（向后兼容）

在现有 `{"content": chunk}` 与 `[DONE]` 之间新增：

```jsonc
// 工具开始
{"type":"tool_call_start","name":"search_articles","args":{"query":"AI"}}
// 工具结束
{"type":"tool_call_end","name":"search_articles","result_summary":"找到 3 篇"}
// 内容流（不变）
{"content":"..."}
// 收敛
[DONE]
```

旧客户端：忽略未知 key 即可正常显示 content 流。前端需识别新事件渲染"正在搜索 AI … 找到 3 篇"。

### ChatMessage 落库形态（migration 016）

```python
class ChatMessage(Base):
    # 现有：id, chat_id, conversation_id, role, content, attachments, created_at
    # 新增可空三列：
    tool_calls: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)  # assistant 发起的 tool_calls
    tool_call_id: Mapped[str | None]    # role=tool 时关联的 tool_call_id
    name: Mapped[str | None]            # role=tool 时工具名
```

role 取值扩展为 `"user" | "assistant" | "tool"`。agent loop 每轮产生的 assistant(含 tool_calls) / tool 消息分别入库；最终回答的 assistant 消息入库（content 填完整流式拼接）。

### history 回放

重进对话时：从 `ChatMessage` 拉全部历史（含 tool 消息），按 OpenAI messages 格式重建：
- `role=user` / `role=assistant`(可能带 tool_calls) / `role=tool`(带 tool_call_id+name) 原序拼回。
- 不需要重新执行搜索——工具结果已在 tool 消息里。
- 这是选 (β) 的核心收益。

### 护栏

`MAX_TOOL_ROUNDS = 8`。每轮若收到 tool_call，round +1；达到 8 时不再发起 tool 调用，往 messages 注入 `system: "已达工具调用上限，请基于已获取信息回答本条消息。"` 后做最后一次无 tools 流式生成 → 收敛。

### 降级

- `user.ai_cross_article_search == false`：tools 列表为空 → 等价一次无工具 LLM 调用，走 stream_chat 路径。loop 只跑一轮。
- agent loop 抛异常：catch → 降级为现 `stream_chat`（无 tools）走完，不阻断 chat（R8）。

## 检索升级（retrieval.py R4）

`_tokenize` 重写：

```python
import jieba
def _tokenize(query: str) -> list[str]:
    if not query: return []
    tokens = [t for t in jieba.cut(query, cut_all=False)
              if len(t.strip()) >= 2 and t.lower() not in STOPWORDS]
    return tokens
```

`retrieve_relevant_articles` 契约不变；ILIKE 匹配逻辑不变——jieba 把整句切成实词后，`%实词%` 子串命中自然成立。
单测：现有 19 条改 expectations（断言切词结果变化），新增"整句 vs 标题实词命中"端到端用例。

## 兼容 / 迁移

- migration 016：3 个可空列，不破坏历史数据；role 仍 NOT NULL。
- legacy `/articles/{id}/chat`：已预置 ConversationReference 的会话仍走同一 `run_agent_chat`；已预置的文章作为已有 ref，不影响 agent 是否再搜（agent 仍可凭模型判断 search_articles）。
- jieba 加入 `pyproject.toml` 依赖。

## Trade-offs

- **流式 + tool_calls 累积复杂**：OpenAI 流式协议下 tool_calls 是分片 delta，需按 index 累积 arguments 字符串。这是实现最易踩坑点，需单测覆盖。
- **每轮都持久化**：比原"只存最终回答"IO 多，但为保证 history 可回放必要。
- **tool result 不回显给用户全文**：SSE 只发 result_summary，正文留在 tool message 走模型消化——避免前端 flooding。

## 不做

- WebSocket、外部 HTTP 工具、translate/list_feeds 工具、摘要/翻译场景 agent 化（见 PRD Out of Scope）。
