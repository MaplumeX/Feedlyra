# 设置页订阅源统一管理视图

## Goal

在设置页的"订阅"标签页中增加统一的订阅源管理视图，让用户可以在一个集中的位置查看、编辑、删除所有订阅源及其分类，而不仅仅依赖侧边栏的右键菜单。

## What I already know

* Settings 是一个 Dialog（非路由页面），当前宽度 `sm:max-w-[480px]`
* SubscriptionsTab 目前只有 OPML 导入/导出功能，无订阅源列表
* 后端 API 已完整覆盖 Feed CRUD、Category CRUD、refresh、discover 等操作，无需新增后端接口
* 前端已有 react-query hooks：useFeeds, useAddFeed, useDeleteFeed, useUpdateFeed, useRefreshFeed, useCategories, useCreateCategory 等
* Feed 数据包含 parsing_error_count / parsing_error_message / checked_at 但当前 UI 未展示
* 分类管理目前仅在侧边栏（创建、重命名、删除），设置页无分类管理
* shadcn/ui 未安装 Table 组件
* 应用使用 react-i18next，settings 命名空间

## Assumptions (temporary)

* 不需要新的后端 API
* 管理视图放在设置对话框的订阅标签页内（可能需要调整对话框尺寸）
* 保留现有 OPML 导入/导出功能

## Open Questions

* (已全部解决，见 Decision 章节)

## Requirements (evolving)

* 在设置页订阅标签页中展示所有订阅源列表
* 支持对单个订阅源进行编辑（标题、分类）和删除
* 支持分类管理（创建、重命名、删除分类）
* 保留 OPML 导入/导出功能

## Acceptance Criteria (evolving)

* [ ] 订阅标签页展示完整的订阅源列表
* [ ] 可以编辑订阅源标题和分类
* [ ] 可以删除订阅源（带确认）
* [ ] 可以创建、重命名、删除分类
* [ ] OPML 导入/导出功能不受影响

## Definition of Done

* Lint / typecheck 通过
* i18n 完整（中英双语）
* 功能在浏览器中可正常使用

## Out of Scope (explicit)

* 批量操作（批量删除、批量移动分类）
* 订阅源错误状态展示/高亮
* 订阅源排序/筛选

## Decision (ADR-lite)

**Context**: SettingsDialog 当前宽度 480px，不足以容纳订阅源管理视图
**Decision**: 切换到订阅标签页时动态扩宽 SettingsDialog 至 max-w-2xl（672px），其他标签页保持原宽
**Consequences**: 订阅标签页有足够空间；切换标签时对话框宽度会变化，需确保过渡自然

**Context**: 订阅源列表需要一种组织形式
**Decision**: 扁平列表 + 分类标签（Badge），所有源平铺展示，每行显示图标、标题、所属分类标签，通过 DropdownMenu 操作编辑/删除
**Consequences**: 不需要折叠/展开操作，信息一目了然；分类管理单独作为列表上方的区域

**Context**: 分类管理在设置页中的布局位置
**Decision**: 列表上方独立区域，用横向排列的 Badge/Tag 展示各分类（可编辑、可删除、有"+"添加按钮），下方是订阅源扁平列表
**Consequences**: 分类和订阅源视觉分区清晰；横向 Badge 占空间少，不干扰主列表

**Context**: 编辑订阅源的交互方式
**Decision**: 复用已有 FeedSettingsDialog，点击列表行编辑按钮弹出，与侧边栏右键体验一致
**Consequences**: 无需新建编辑组件，减少代码量；但存在对话框嵌套（SettingsDialog 内弹 FeedSettingsDialog），需确保 z-index 正确

## Technical Notes

* 后端 API 完整，无需新增
* SettingsDialog 切换到订阅标签页时动态扩宽至 max-w-2xl
* 无需 Table 组件，使用自定义列表行渲染
* FeedIcon 组件可复用
* 已有 FeedSettingsDialog 可复用，注意对话框嵌套 z-index
* 分类管理：横向 Badge 区域 + 添加/编辑/删除操作
* 订阅源列表：扁平列表，每行含 FeedIcon、标题、分类 Badge、DropdownMenu（编辑/删除）
* i18n: react-i18next settings 命名空间
