# Feed Category/Folder Support

## Goal

为订阅源添加单层分类功能，让用户可以按主题自定义组织订阅源，改善大量订阅时的浏览体验。

## Requirements

* 用户可以创建、重命名、删除分类
* 用户可以将 feed 移入分类（添加 feed 时可选、FeedSettings 可改）
* 侧边栏按分类分组展示 feed，每个分类可折叠
* "未分类"固定分组在底部，显示未归入任何分类的 feed
* OPML 导出按分类嵌套 outline，导入时解析嵌套还原分类
* 删除分类时，其下 feed 自动回到未分类

## Acceptance Criteria

* [ ] 新增 categories 表 + Alembic 迁移
* [ ] Categories CRUD API（创建、列表、重命名、删除）
* [ ] FeedUpdate / FeedCreate 支持 category_id
* [ ] FeedWithUnread 响应包含 category 信息
* [ ] 侧边栏按分类分组显示 feed
* [ ] "未分类"固定分组显示无分类 feed
* [ ] 添加 feed 对话框可选分类
* [ ] FeedSettings 对话框可改分类
* [ ] OPML 导出按分类嵌套 outline
* [ ] OPML 导入解析嵌套 outline 还原分类
* [ ] 删除分类时 feed 回到未分类
* [ ] i18n key 已添加

## Definition of Done

* Alembic migration created and tested
* Backend tests added/updated
* Frontend typecheck pass
* i18n keys added for new UI text
* Lint / CI green

## Technical Approach

### Backend

* 新增 `categories` 表：id (UUID), user_id (FK), title (String 200), created_at, updated_at
* `feeds` 表新增 `category_id` 列 (nullable FK → categories.id, ON DELETE SET NULL)
* 新增 `/api/categories` CRUD 端点（POST 创建、GET 列表、PUT 重命名、DELETE 删除）
* FeedCreate 增加 `category_id` 可选字段
* FeedUpdate 增加 `category_id` 可选字段
* FeedWithUnread 增加 `category_id` / `category_name` 字段
* OPML export: 按分类分组生成嵌套 outline
* OPML import: 解析嵌套 outline，自动创建分类并关联 feed

### Frontend

* 新增 Category TypeScript 类型
* 新增 categories API hooks（CRUD）
* Sidebar: 按分类分组渲染，每个分类用 Collapsible 包裹，底部"未分类"组
* AddFeedDialog: 添加分类选择下拉
* FeedSettingsDialog: 添加分类选择下拉
* Feed 类型增加 category_id / category_name
* 右键菜单增加"移动到分类"选项

## Decision (ADR-lite)

**Context**: 需要决定分类层级深度、未分类 feed 展示方式、OPML 分类支持范围
**Decision**: 单层分类 + 固定"未分类"分组 + OPML 支持分类 + MVP 包含添加/设置时选分类
**Consequences**: 实现简洁，未来如需嵌套分类需要改模型和 UI，但单层覆盖绝大多数场景

## Out of Scope

* 嵌套/父子分类
* 分类拖拽排序
* 分类颜色/图标自定义
* 空分类的显隐控制（空分类也显示）
* 分类级别的未读计数聚合（可作为后续增强）

## Technical Notes

* Backend model: backend/app/models/feed.py — 新增 Category 模型
* Backend schema: backend/app/schemas/feed.py — 扩展 FeedCreate/FeedUpdate/FeedWithUnread
* Backend router: backend/app/routers/feeds.py — OPML 逻辑; 新增 categories.py
* Frontend Sidebar: frontend/src/components/Sidebar.tsx
* Frontend AddFeedDialog: frontend/src/components/AddFeedDialog.tsx
* Frontend FeedSettingsDialog: frontend/src/components/FeedSettingsDialog.tsx
* Frontend types: frontend/src/api/types.ts
* Frontend hooks: frontend/src/api/hooks.ts
* OPML 标准参考: OPML 2.0 支持 outline 嵌套，外层 outline 无 xmlUrl 的是分类
