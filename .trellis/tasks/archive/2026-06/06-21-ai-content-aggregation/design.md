# 技术设计 — AI 内容聚合(MVP:跨文章问答自动检索)

> 关联 PRD: `prd.md`
> 范围:仅 MVP(① 自动检索增强)。本设计为 ②③④ 预留检索服务接口,不实现它们。

## 设计目标与非目标

- 目标:在**不新建数据模型、不引入新依赖**的前提下,给现有 `_do_conversation_chat` 接上"自动检索相关文章"环节。
- 非目标:不做向量检索、不做全文搜索 UI、不做 digest 调度。检索服务接口要稳定,方便后续替换实现。

## 架构总览

```
用户提问 (POST /api/ai/conversations/{id}/chat)
        │
        ▼
_do_conversation_chat  (routers/ai.py 现有)
        │
        ├─ 1. 拉取现有 ConversationReference
        │
        ├─ 2. 新增: 若 refs 为空 且 user.ai_cross_article_search 为真
        │      └─ 调 services/retrieval.py::retrieve_relevant_articles()
        │           返回 top-K 篇 Article
        │      └─ 批量 INSERT ConversationReference(is_auto=True)
        │           (on_conflict_do_nothing,唯一约束已守门)
        │
        ├─ 3. 重新拉取 refs → 拼接 readable_content
        │      (现有逻辑:复用 build_chat_messages 的 articles 分支)
        │
        └─ 4. 现有 chat stream (stream_chat + SSE)
```

关键点:**steps 1→2→3 顺序**,让"自动加入的 ref"和"手动加入的 ref"走同一条 prompt 组装路径,无新分支。

## 模块 1:检索服务(`backend/app/services/retrieval.py` 新建)

### 接口签名(稳定契约,后续可换向量实现)

```python
async def retrieve_relevant_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    since: datetime | None = None,   # None=now - days
    days: int = 7,                    # 默认 7 天
    limit: int = 5,                   # top-K
) -> list[Article]: ...
```

- 返回值保持为 `list[Article]`(已按相关性 + 时效排序),调用方负责转 `ConversationReference`。
- 参数 `since` 显式入参的用意:`since: datetime` 是 ②digest(过去 24h)复用的入口。

### 检索算法(关键词,纯 SQL)

1. **Token 化**(在 Python 侧,不依赖 PG 分词):
   ```python
   import re
   # 提取长度>=2 的连续英文单词或 CJK 汉字块
   raw_tokens = re.findall(r"[A-Za-z0-9]{2,}|[\u4e00-\u9fff]{2,}", query)
   # 简单中英停用词过滤(约 20 词以内)
   tokens = [t for t in raw_tokens if t.lower() not in STOPWORDS]
   ```
   - 中文按"汉字连续块"为一个 token,不分字。例:query `"最近 OpenAI 的动态"` → `["最近", "OpenAI", "动态"]`。
   - 不引 jieba:`ILIKE %token%` 对中文子串天然友好,精度足够 MVP。
2. **候选集构造**:
   ```sql
   SELECT a.*, COALESCE(s.summary, '') AS summary_text
   FROM articles a
   JOIN feeds f ON f.id = a.feed_id
   LEFT JOIN article_summaries s
     ON s.article_id = a.id
    AND s.source = 'feed'        -- 用摘要源(便宜、覆盖广)
   WHERE f.user_id = :user_id
     AND COALESCE(a.published_at, a.created_at) >= :since
   ```
   - 用户隔离复用 `Feed.user_id`(现有约定)。
   - 时间窗取 `COALESCE(published_at, created_at)`,兜底缺 `published_at` 的源。
3. **打分**(Python 侧遍历候选,简单计数):
   ```python
   for article in candidates:
       hay = f"{article.title} {summary_text}".lower()
       hits = sum(1 for t in tokens if t.lower() in hay)
       if hits:
           scored.append((hits, article.published_at or article.created_at, article))
   # 排序:hits DESC, 然后 published_at DESC
   ```
   - Top-K 截断在排序后取前 `limit` 篇。
   - 若 `len(tokens) == 0` 或无命中,返回空列表(不阻塞 chat,后端降级为"无可引用文章"走原有无引用分支)。

### 性能预算

- 候选集规模:`7天 × 该用户订阅源数 × 平均日更`,典型单用户 < 500 行。
- 在此规模下,Python 循环打分 < 10ms,可接受。不建索引、不引扩展。
- 未来若上量,候选集过大才考虑 `pg_trgm` GIN 或上向量检索(届时只换此函数实现,契约不变)。

## 模块 2:User 字段 + Schema + 迁移

### Model 改动(`backend/app/models/user.py`)

```python
ai_cross_article_search: Mapped[bool] = mapped_column(
    Boolean, default=True, server_default="true", nullable=False
)
```
- 放在现有 `translate_default_lang` 附近,保持 AI 设置字段聚集。

### Schema 改动(`backend/app/schemas/ai.py`)

- `AIConfigUpdate` 加 `cross_article_search: bool | None = None`
- `AIConfigResponse` 加 `cross_article_search: bool = True`
- (`FeatureAIConfigUpdate` 不动——这是全局开关,不是 per-feature)

### Router 改动(`backend/app/routers/ai.py`)

- `update_ai_config`:加 `if body.cross_article_search is not None: user.ai_cross_article_search = body.cross_article_search`
- `get_ai_config`:返回字典加 `"cross_article_search": user.ai_cross_article_search`

### 迁移 `015_cross_article_search.py`

```python
def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ai_cross_article_search", sa.Boolean(),
                   server_default="true", nullable=False),
    )

def downgrade() -> None:
    op.drop_column("users", "ai_cross_article_search")
```

- 不引入 `CREATE EXTENSION`,不建索引。零风险迁移。
- `down_revision = "014"`。

## 模块 3:接入 `_do_conversation_chat`(`backend/app/routers/ai.py`)

改动点:`_do_conversation_chat` 内,**在现有 "Get all referenced articles" 查询之前**,插入自动检索逻辑:

```python
# 现有: refs_result = await db.execute(select(ConversationReference)...)
# 改为: 先拉现有 ref 数量
existing_refs_count = await db.scalar(
    select(func.count(ConversationReference.id))
    .where(ConversationReference.conversation_id == conv.id)
)

if (
    existing_refs_count == 0
    and getattr(user, "ai_cross_article_search", True)
):
    try:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        retrieved = await retrieve_relevant_articles(
            db, user_id=user.id, query=body.message, since=since, limit=5
        )
        if retrieved:
            # 批量插入,忽略重复(唯一约束 conversation_id+article_id)
            for art in retrieved:
                db.add(ConversationReference(
                    conversation_id=conv.id,
                    article_id=art.id,
                    is_auto=True,
                ))
            await db.commit()  # 用 flush 也行;commit 让后续重拉看到
    except Exception:
        logger.exception("Auto-retrieval failed, continuing without references")
        # 降级:不阻塞对话,chat 照常用现有(空)refs 走
```

- **触发判定**:无现有 ref(`existing_refs_count == 0`)。Q4-a。
- **开关**:`user.ai_cross_article_search`。
- **降级**:检索任何异常都 try/except 吞掉,只记日志,保证 chat 不中断。
- 注意:插入后要 flush/commit,否则后续现有 `refs_result` 查询看不到新插入(auto-flush 机制下 SQLAlchemy 一般会自动同步,但显式 commit 保险)。实测后决定。

### 失败重试 / 超时

- 检索是本地 DB 查询,无外部 API 调用,基本无超时风险。
- 不加超时熔断(避免过度工程)。如果将来换向量实现(调 embedding API),届时再加 timeout。

## 模块 4:前端改动(最小化)

### `AISettingsTab.tsx`

- 加一个 `<Switch>`,绑定 `cross_article_search`。
- 在 `updateAIConfig` mutation 的 payload 加 `cross_article_search`,复用现有提交流程。

### 类型(`api/types.ts`)

- `AIConfig` 接口加 `cross_article_search: boolean`
- `AIConfigUpdate` 类型加 `cross_article_search?: boolean`

### 不动的地方

- 对话页 UI、引用 chip 展示、SSE 流处理——全部现有逻辑已能展示 `is_auto=true` 的 chip(代码探索确认 `ConversationSidebar` 已渲染)。本次**不触碰**。

## 数据流契约

### 请求不变
`POST /api/ai/conversations/{id}/chat` body 不变(`ChatRequest`)。

### 副作用新增
- `ConversationReference` 行被自动插入(`is_auto=true`)。
- `conversation.updated_at` 通过现有逻辑更新。

### 响应不变
SSE 流格式不变,仍通过现有 `useConversationReferences` 拉取列表看到新 ref。

## 兼容性 & 回滚

- 旧对话:已有手动 ref 的,触发判定跳过,行为完全不变。
- 关闭开关:用户关闭后行为回到改动前(无自动检索)。
- 数据库回滚:`alembic downgrade -1` 移除字段。已自动加入的 `ConversationReference` 行保留(无害,用户可手动删)。

## 关键权衡记录

1. **不用 pgvector/embedding**:MVP 阶段召回质量"够用即可",省去运维负担;代价是语义弱(同义词、近义改写召回不到)。可接受——MVP 主要验证"用户用不用得起来"。
2. **不在 PG 侧分词**:Python token 化更易调试、易替换;代价是候选集要传回 Python 打分。候选集规模小,可接受。
3. **auto-ref 写进 ConversationReference 持久化**:好处是复用现有 reference UI 与 prompt 组装;代价是用户可见这些 auto-ref(但有 `is_auto` 标记,且可删)。比"仅放在内存里本次问答"更可观测。
4. **检索不写 prompt**:检索函数只返回 Article,不直接动 prompt;让现有 `build_chat_messages(articles=...)` 统一拼装,保持单一 prompt 组装入口。
