# AI 内容聚合能力扩展

> 状态: Phase 1 规划中(brainstorm)
> 创建: 2026-06-21
> Owner: maplume

## 背景与目标

当前 AI 能力都服务于**单篇文章**(摘要 / 翻译 / 对话)。本任务扩展到**跨文章、时间窗、主题级**的聚合 AI 能力,覆盖四个候选方向:

1. 每日早报 digest(跨源 × 时间窗聚合 + 摘要,定时生成)
2. 跨文章问答(基于问题自动检索相关文章 → 多文章上下文对话)
3. 重复新闻去重 / 聚类(同事件多源转载自动归并)
4. AI 智能过滤(按兴趣/语义自动隐藏不相关文章,超越关键词规则)

四个候选共享一个底层能力:**从一堆文章里选出/聚合与某主题相关的那些**。这是本任务的核心技术决策点。

## 已确认事实(代码探索)

### 可复用的现有基础
- **多文章对话已半成品**:`Conversation` + `ConversationReference` 模型已存在,一个对话可绑多篇文章;`_do_conversation_chat`(routers/ai.py)已把所有引用文章的 `readable_content` 拼进 system prompt。
- **multi-article prompt 已实现**:`build_chat_messages` 的 `articles` 参数,llm.py 的 `CHAT_MULTI_ARTICLE_SYSTEM_PROMPT`,20000 字符预算按文章分配。
- **可读内容属性**:`Article.readable_content` = full_content || content || content_snippet。
- **摘要缓存**:`ArticleSummary` 表(article_id+source+model+content_hash 联合唯一),按内容哈希缓存。
- **翻译缓存**:`ArticleAIData` 表。
- **AI 全 BYOK**:每用户独立 API key(Fernet 加密),translate/summary/chat 三 feature 各自可配 base_url/key/model,有服务端默认兜底。
- **规则引擎已存在**:`AutomationRule`(scope: global/feed/category,conditions: AND/OR 组合,actions: delete/mark_read/star/auto_translate/auto_extract)。但 condition operator 仅 `contains`/`not_contains`/`matches_regex`(纯关键词式,无语义/embedding)。
- **定时调度**:`main.py` lifespan 用单进程 `asyncio.create_task` + 5 分钟 sleep 循环刷新订阅源。

### 完全空白(无现有实现)
- 全文搜索端点(所有 router 中 `grep search` 无结果)。
- embedding / 向量列 / 向量索引(无 embedding 模型、无 pgvector 引用)。
- 定时聚合任务(digest 调度)。
- digest / 聚类相关的数据表结构。
- `ArticleChat` 表与 legacy `/articles/{id}/chat` 端点仍保留(已被 `Conversation` 取代)。

### 四个候选的现状基线

| 候选 | 可复用基础 | 主要缺口 |
|---|---|---|
| 跨文章问答(自动检索增强) | Conversation/Reference、multi-article prompt、readable_content | "自动选文章"环节——现需手动引用 |
| 每日 digest | 无 | 定时任务、聚合逻辑、digest 存储、调度 |
| 重复新闻去重/聚类 | 无 | 相似度计算、聚类算法 |
| AI 智能过滤 | automation 规则(但 condition 仅关键词式) | 语义 condition(embedding 或 LLM 判断) |

## 需求

### 功能需求

1. **检索服务**(独立、可替换):封装 `services/retrieval.py::retrieve_relevant_articles()`,输入 `(user_id, query, since=None, days=7, limit=5)` → 返回相关 `Article` 列表。关键词 token 化后,在 `title` + 已缓存的 `ArticleSummary.summary` 上 ILIKE 匹配,按命中数×发布时间新评分。接口稳定、实现可后续替换为向量检索。
2. **自动检索接入对话**:`_do_conversation_chat` 在拉取现有 references 后,若当前对话无任何 reference 且用户开启 `ai_cross_article_search`,则调检索函数召回 top-K 篇(默认 5),以 `is_auto=True` 写入 `ConversationReference`(忽略重复——唯一约束已守门)。
3. **用户开关**:新增 `User.ai_cross_article_search: bool default=true`,默认开启;暴露在 AI 设置页(`AISettingsTab`)作一个 switch,写入走现有 `AIConfigUpdate`。
4. **检索范围**:默认最近 7 天(`published_at >= now - 7 days`,fallback `created_at`),前端不作范围控制器(MVP)。
5. **可选——检索结果可选可见**:chat 开流不提醒检索了哪些文章;以现有 `useConversationReferences` 拉取列表后,`is_auto=true` 的 chip 会被前端现有逻辑区分展示(无需额外前端修改)。

## 验收标准

1. 发起一场新对话,不手动添加任何 reference,提问一个能在最近 7 天文章标题中找到关键词的问题 → API 响应流中能正常返回内容,且该对话的 references 列表出现 `is_auto=true` 的条目(命中的文章数量在 1~K 之间,K=5)。
2. 发起新对话并手动引用一篇文 → 用户提问时,不重复检索,该对话的 reference 中不存在系统自动加入的 `is_auto=true` 条目。
3. 在 AI 设置页关闭开关后发起新对话并提问 → 不调用检索函数,对话的 references 始终为空,LLM 上下文仅含问题。
4. 检索函数单测:给定几天内的一组文章 + 一个 query,返回按命中数排序的 top-K,且仅含 `published_at >= now - N days` 范围内的(覆盖 `created_at` fallback 场景)。
5. 现有 chat / translation / summary 流跑测试套件全过,无回归。
6. 迁移可正常 `alembic upgrade head` 并回滚(新增字段、表、索引)。
7. `ruff` / `mypy` / 前端 `tsc` 与 `build` 全过。

## 范围外

- 向量检索 / embedding / pgvector(抽象接口预留,MVP 不实现)。
- 历史旧文全文搜索(属“全文搜索”后续任务)。
- 每日 digest / 定时聚合 / 聚类去重 / AI 智能过滤(②③④ 长期候选,本任务仅为其预留检索服务接口)。
- 手动“搜文章加入对话”的 UI 与端点(本次不建,后续增量补)。
- 检索范围的 UI 控制(默认 7 天,MVP 不开参数)。
- 检索质量调优(如 BM25、复现打分)——MVP 用简单的命中数×倒序。
- 中文 jieba 分词——MVP 用正则 token 化,召回质量不够再在下一迭代引入。

## 待决问题(阻塞规划)

- [x] Q1: MVP 选哪个候选作为首个交付?
　- **决定: ① 跨文章问答的自动检索增强。**
　- 理由:复用现有 `Conversation`/`ConversationReference`/multi-article prompt,不新建数据模型;其"检索召回"环节是 ②③④ 共享的技术底座,先做即铺地基;验证成本最低。
- [x] Q2: 检索的技术路线(关键词 vs 向量 vs LLM 直选)
　- **决定: A 关键词检索。**
　- 理由:零新依赖(纯 PG,不引 pgvector)、复用已缓存的 `ArticleSummary` 提升召回、检索做成独立 `services/retrieval.py` 后续可无缝换成向量。避免一次性支付 embedding 选型/入库同步/失败重试等运维 cost。
　- 架构约束:"根据 query 召回相关文章"封装为独立服务函数,接口稳定,实现可替换,为 ②③④ 复用预留。
- [x] Q3: 检索范围(全库 / 最近 N 天 / 当前 feed)
　- **决定: ii 最近 N 天(默认 7 天,N 可配)。**
　- 理由:匹配问答场景时效直觉;`published_at >= now - N days` 过滤收窄候选集,trigram 扫描范围可控;时间窗参数化("since: datetime" 入口)为 ②digest 复用预留。
　- 职责边界:历史旧文检索属"全文搜索"职责,不塞进跨文章问答 MVP。
- [x] Q4: 触发方式(提问时自动检索 / 手动搜文章加入对话)
　- **决定: A 提问时自动检索 + 触发判定 a(无现有引用时触发)。**
　- 理由:复用现有 chat 流与 reference UI,前端几乎不动;`_do_conversation_chat` 前插入一步检索,命中即以 `is_auto=True` 写入 `ConversationReference`;尊重用户手动引用意图(已在引用时不重复检索)。
　- 自动检索开关:默认开启,设置可关(下一问题确认)。
- [x] Q5: 自动检索开关(默认开+可关 / 默认关+手动启)
　- **决定: A 默认开 + 设置可关。**
　- 落地:新增 `User.ai_cross_article_search` 布尔字段(默认 true),复用现有 `AIConfigUpdate`/`AISettingsTab` 模式加一个 switch。MVP 目的在验证,默认开才能拿真实反馈。
