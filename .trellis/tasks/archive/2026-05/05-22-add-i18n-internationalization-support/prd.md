# Add i18n Internationalization Support

## Goal

为 Feedlyra RSS 阅读器添加国际化（i18n）支持，使 UI 文本可从硬编码英文提取为可翻译的键值对，支持多语言切换。

## What I already know

* React 19 + TypeScript + Vite 6 前端，shadcn/ui 组件库
* 当前零 i18n 基础设施，所有 UI 文本硬编码英文
* 约 80-100 个硬编码字符串分布在 7 个核心组件中
* Zod 验证消息也是硬编码英文（8 处）
* 日期格式化使用 `toLocaleDateString()`，部分具备 locale 感知能力但 "Today"/"Yesterday" 是硬编码英文
* 后端 LLM 系统 prompt（llm.py）也是英文，但属于 AI 行为而非 UI 文本
* 应用有文章翻译功能（AI 翻译内容到 zh），与 UI i18n 无关
* Zustand 状态管理（auth.ts, reader.ts）已做持久化

## Requirements

* 使用 react-i18next + i18next 作为 i18n 框架
* 使用 i18next-browser-languagedetector 做语言检测和持久化
* 使用 zod-i18n-map 做 Zod 验证消息国际化
* 提取所有硬编码 UI 字符串到翻译 JSON 文件
* 首批支持中文简体（zh-CN）和英文（en）
* 提供语言切换 UI 组件
* 语言偏好持久化（通过 i18next-browser-languagedetector 的 localStorage）
* 日期格式化跟随当前语言 locale
* 切换语言后 UI 即时更新，无需刷新

## Acceptance Criteria

* [ ] 所有 UI 文本不再硬编码，均通过 t() 函数引用
* [ ] 支持 zh-CN 和 en 切换
* [ ] 切换语言后 UI 即时更新，无需刷新
* [ ] 语言偏好持久化，重启后保留
* [ ] Zod 验证消息随语言切换（通过 zod-i18n-map）
* [ ] 日期格式化跟随当前 locale
* [ ] shadcn/ui dialog 关闭按钮 aria 标签也国际化

## Definition of Done

* Lint / typecheck / CI green
* 翻译文件结构清晰，易于添加新语言
* 添加新语言只需新增 JSON 文件，无需改代码

## Technical Approach

* **i18n 库**: react-i18next 17 + i18next 26（推荐，唯一有成熟 Zod 集成的方案）
* **语言检测**: i18next-browser-languagedetector（localStorage 持久化）
* **Zod 集成**: zod-i18n-map，通过 `z.setErrorMap(zodI18nMap)` 全局替换
* **翻译文件**: 静态 JSON 导入（2 种语言，无需懒加载）
* **翻译文件结构**: 按功能模块命名空间拆分（common, auth, reader, settings），每个 namespace 对应一个 JSON 文件，便于维护和扩展
* **语言切换 UI**: 侧边栏底部 DropdownMenu + Languages 图标
* **日期格式化**: `toLocaleDateString(i18n.language, ...)` + i18n key 替换 Today/Yesterday
* **Zod 自定义消息**: 通过 `params: { i18n: "key" }` 支持 refine 消息翻译

## Decision (ADR-lite)

**Context**: 需要为 React 19 + Vite 6 项目选择 i18n 方案，要求支持 Zod 验证消息翻译
**Decision**: 采用 react-i18next + i18next + i18next-browser-languagedetector + zod-i18n-map
**Consequences**: 依赖 i18next 生态系统（最大社区），bundle 增加 ~23KB gzip；zod-i18n-map 提供开箱即用的 30 种语言 Zod 消息

## Research References

* [research/react-i18n-libraries.md](research/react-i18n-libraries.md) — react-i18next vs react-intl vs lingui vs rosetta 对比，推荐 react-i18next
* [research/i18n-integration-patterns.md](research/i18n-integration-patterns.md) — Zod、shadcn/ui、Zustand、Vite、日期格式化的 i18n 集成模式

## Out of Scope

* 后端 API 错误消息 i18n
* 后端 LLM 系统 prompt i18n
* RTL 语言支持
* 自动翻译（机器翻译生成翻译文件）
* 懒加载翻译文件（2 种语言不需要）

## Technical Notes

* 硬编码字符串分布：Sidebar.tsx, ArticleList.tsx, ArticleDetail.tsx, AddFeedDialog.tsx, AIChatPanel.tsx, CommandPalette.tsx, LoginPage.tsx, RegisterPage.tsx, AISettings.tsx
* Zod schema 在 LoginPage (2处), RegisterPage (5处), AISettings (2处) 中使用 message 属性
* 日期相关：ArticleList.tsx 中的 "Today"/"Yesterday" 及 toLocaleDateString(undefined, ...)
* shadcn/ui dialog.tsx 第 44 行有硬编码 "Close" sr-only 标签
* Zustand persist 已用于 auth 和 reader stores — 语言状态由 i18next 管理，不放入 Zustand
