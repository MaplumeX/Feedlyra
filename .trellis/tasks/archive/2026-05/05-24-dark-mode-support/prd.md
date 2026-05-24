# Dark Mode Support (夜间模式)

## Goal

为 Feedlyra 添加夜间模式支持，支持亮色/暗色/跟随系统三态切换，切换 UI 位于 Sidebar 底部。

## What I already know

* Tailwind CSS v3.4 已配置 `darkMode: ["class"]` 策略
* `index.css` 中 `:root`（亮色）和 `.dark`（暗色）CSS 变量已完整定义
* shadcn/ui 组件原生支持 dark mode（基于 CSS 变量）
* 当前缺少：ThemeProvider / useTheme hook / 主题切换 UI 组件
* 唯一使用 dark class 的地方：`ArticleDetail.tsx` 中的 `dark:prose-invert`

## Assumptions (resolved)

* 使用 `next-themes` 管理主题状态（class 策略，支持 system 主题）
* 主题偏好持久化到 localStorage
* 默认跟随系统偏好（prefers-color-scheme）

## Open Questions

(已解决)

## Requirements

* 添加 ThemeProvider 包裹应用（基于 next-themes）
* Sidebar 底部添加主题切换按钮（三态：亮/暗/系统，点击循环切换）
* 按钮图标反映当前状态（Sun/Moon/Monitor）
* 主题偏好持久化（localStorage）
* 所有页面/组件在暗色模式下视觉正确
* 无 FOUC（页面加载闪烁）

## Acceptance Criteria

* [ ] 用户可在 亮→暗→系统 间循环切换
* [ ] 图标正确反映当前主题状态
* [ ] 刷新页面后主题偏好保留
* [ ] 系统主题切换时自动跟随（当处于 system 模式）
* [ ] 所有现有组件在暗色模式下显示正确
* [ ] 无 FOUC（页面加载闪烁）

## Definition of Done

* 所有页面暗色模式视觉验证通过
* Lint / typecheck / CI green
* 无 FOUC

## Out of Scope

* 自定义主题色（仅支持亮/暗两态）
* 每个订阅源单独设置主题
* 设置面板内的主题选择器（仅 Sidebar 底部快捷切换）

## Technical Notes

* CSS 变量体系已就绪，无需修改颜色定义
* shadcn/ui 组件基于 CSS 变量，自动适配 dark mode
* 需检查自定义组件（Sidebar, ArticleList, ArticleDetail 等）的硬编码颜色
* `ArticleDetail.tsx` 已有 `dark:prose-invert`，需确保完整覆盖
* next-themes 需在 App.tsx 最外层包裹 ThemeProvider，attribute="class"
