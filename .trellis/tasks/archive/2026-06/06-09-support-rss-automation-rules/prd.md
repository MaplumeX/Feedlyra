# Support RSS Automation Rules

## Goal

为 Feedlyra 添加自动化规则功能，让用户可以基于多条件（AND/OR 组合）自动对新文章执行操作，支持全局/分类/订阅源三级作用域。

## Research References

* [`research/rss-automation-patterns.md`](research/rss-automation-patterns.md) — 主流 RSS 阅读器自动化功能对比：Inoreader/full wizard，FreshRSS/search+action 对，Miniflux/regex block-keep

## Decision (ADR-lite)

**Context**: 需要选择规则系统的架构模式。Inoreador 式向导功能最强但复杂度高；FreshRSS 搜索语法简洁但不够直观；Miniflux 正则仅过滤无动作。

**Decision**: 采用 FreshRSS 风格的"条件 + 动作对"模型，但 UI 采用 Inoreader 风格的可视化条件构建器（非搜索语法），条件支持 AND/OR 组合。

**Consequences**: 后端数据模型简洁（条件存为 JSON），前端需要条件构建器组件（有一定复杂度但可控）。未来可扩展 tag/label 动作、webhook 等无需改模型。

## Requirements

### Actions (MVP)

| Action | 说明 | 额外参数 |
|--------|------|----------|
| mark_read | 自动标记已读 | 无 |
| star | 自动收藏 | 无 |
| delete | 不入库（在 fetch 阶段跳过） | 无 |
| auto_translate | 自动翻译 | translate_target_lang |
| auto_extract | 自动抓取全文 | 无 |

### Conditions

- 多条件 AND/OR 组合
- 每个条件：字段（title / author / url / content）+ 匹配方式（contains / not_contains / matches_regex）+ 值
- 条件组之间支持 AND/OR 逻辑运算符

### Scope

- **Global** — 对所有订阅源生效
- **Per-category** — 对分类下所有订阅源生效
- **Per-feed** — 仅对该订阅源生效

### 规则管理

- 规则可启用/禁用
- 规则可设置名称
- 规则按优先级排序执行（同级按创建顺序）
- 同一文章匹配多条规则时全部执行
- delete 动作与其他动作同时匹配时无特殊处理（全部执行，但由于 delete 在 fetch 阶段跳过入库，后续 mark_read/star 对该文章无意义）

### UI 入口

- **独立 Automation 管理页面**：Sidebar 设置按钮旁加规则图标，点击打开全屏规则管理页面，所有层级规则统一管理，可按作用域筛选
- **FeedSettingsDialog 快捷入口**：订阅源设置弹窗中可查看/管理当前订阅源的规则

### 规则执行

- 执行时机：`fetch_and_store_feed()` 中新文章入库后
- delete 动作在入库前执行（直接不入库），其余动作在入库后执行
- 规则执行出错时静默跳过，不影响文章正常抓取

## Acceptance Criteria

- [ ] 可通过 UI CRUD 自动化规则
- [ ] 支持多条件 AND/OR 组合
- [ ] 规则支持三级作用域（global/category/feed）
- [ ] 5 个动作均可正常执行
- [ ] 规则可启用/禁用
- [ ] delete 动作的规则在 fetch 阶段过滤文章
- [ ] auto_translate 动作带有 translate_target_lang 参数
- [ ] FeedSettingsDialog 中可查看当前订阅源规则
- [ ] 新文章抓取后自动匹配规则并执行

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Rollout/rollback considered if risky

## Out of Scope

* Tag/Label 系统（项目暂不支持，动作预留扩展点）
* 通知（推送/邮件/Webhook）
* 回溯应用到已有文章
* 外部服务集成（Pocket、Instapaper 等）
* auto_summarize 作为规则动作
* 规则执行日志 / 匹配统计
* 规则冲突解决策略（除 delete 外无特殊处理）
* 正则条件的验证（用户输入正则不校验，匹配失败等同于不匹配）

## Technical Notes

### 后端

* 新表 `automation_rules`：

```
id: UUID PK
user_id: UUID FK users.id
name: str
enabled: bool (default true)
scope: str (global / category / feed)
scope_id: UUID? (category_id 或 feed_id，scope=global 时 null)
conditions: JSON — [{field, operator, value, logic: and|or}]
actions: JSON — [{type, params?}]
priority: int (default 0)
created_at: datetime
updated_at: datetime
```

* 变更点：
  - 新文件：`models/automation.py`、`schemas/automation.py`、`routers/automation.py`、`services/automation.py`
  - 修改：`models/__init__.py` 注册新模型
  - 修改：`services/feed_fetcher.py` 在 `fetch_and_store_feed()` 中插入规则执行
  - 新增 alembic migration
* delete 动作：在 `fetch_and_store_feed()` 中，新文章入库前先匹配 delete 规则，匹配的文章从 `new_articles` 中移除
* 非 delete 动作：入库后匹配，对匹配的文章创建 `ReadStatus`、`StarredArticle` 等记录，或触发翻译/全文抓取

### 前端

* 新组件：`AutomationPage.tsx`、`RuleEditor.tsx`（条件构建器）、`RuleCard.tsx`
* 修改：`Sidebar.tsx` 添加 Automation 入口按钮
* 修改：`FeedSettingsDialog.tsx` 添加快捷入口查看当前订阅源规则
* 新增：automation API hooks 和 types
* 修改：`App.tsx` 添加 /automation 路由（或作为 Settings 内的 tab）

### 现有文件参考

* `backend/app/models/feed.py` — Feed 模型，auto_full_text/auto_translate 字段参考
* `backend/app/services/feed_fetcher.py` — 规则执行插入点
* `backend/app/routers/feeds.py` — API 风格参考
* `backend/app/schemas/feed.py` — Schema 风格参考
* `frontend/src/components/Sidebar.tsx` — UI 入口位置
* `frontend/src/components/FeedSettingsDialog.tsx` — 快捷入口位置
* `frontend/src/api/hooks.ts` — API hooks 风格
* `frontend/src/api/types.ts` — 类型定义风格
