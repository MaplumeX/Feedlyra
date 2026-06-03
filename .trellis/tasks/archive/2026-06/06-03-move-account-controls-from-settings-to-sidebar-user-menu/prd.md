# Move Account Controls from Settings to Sidebar User Menu

## Goal

将账号相关操作（用户名、邮箱、密码修改、登出）从 Settings Dialog 的 Account tab 移出，改为 Sidebar 底部的 user menu 入口，让用户身份信息一目了然，符合"身份 ≠ 偏好"的心智模型。

## What I already know

* 当前 Account tab 在 SettingsDialog 中，包含：修改用户名、修改邮箱、修改密码、登出
* Sidebar 底部目前只有一个齿轮图标 + ThemeToggle
* 项目已有 `DropdownMenu` UI 组件
* 项目没有 Avatar 组件
* 用户数据来源：`useCurrentUser()` (react-query) + `useAuthStore` (Zustand fallback)
* SettingsDialog 有4个 tab: General, Account, AI, Subscriptions

## Assumptions (temporary)

* 使用 DropdownMenu 而非独立页面，保持改动最小化
* Account tab 从 Settings 中完全移除
* 不引入头像功能（MVP）

## Open Questions

(none remaining)

## Requirements (evolving)

* Sidebar 底部增加当前用户名显示区域（首字母圆形占位 + 用户名文字），点击弹出 DropdownMenu
* DropdownMenu 包含：修改用户名、修改邮箱、修改密码、登出
* 选择"修改XX"时弹出对应的小 Dialog，复用原有表单逻辑
* Settings Dialog 移除 Account tab

## Acceptance Criteria (evolving)

* [ ] Sidebar 底部显示当前用户名，点击弹出下拉菜单
* [ ] 下拉菜单中可修改用户名、邮箱、密码，可登出
* [ ] Settings Dialog 不再包含 Account tab
* [ ] 原有表单验证和保存逻辑正常工作

## Definition of Done

* Lint / typecheck 通过
* 功能可交互验证

## Out of Scope

* 头像上传/显示
* 独立 Profile 页面（/profile 路由）
* 两步验证等未来安全功能

## Technical Approach

DropdownMenu + 子 Dialog 模式：Sidebar 底部显示"首字母圆形 + 用户名"，点击弹出 DropdownMenu（修改用户名/邮箱/密码/登出），选择修改项时弹出对应小 Dialog。原有 AccountSettingsTab 拆分为3个独立 Dialog 组件。

## Decision (ADR-lite)

**Context**: 账号操作埋在 Settings tab 中不符合心智模型，用户身份和偏好应分离。
**Decision**: Sidebar 底部增加 user menu（DropdownMenu + 子 Dialog），Account tab 从 Settings 移除。
**Consequences**: 改动集中在 Sidebar + 新增3个 Dialog 组件；原有表单逻辑和 API 完全复用，风险低。未来加头像/两步验证只需扩展 DropdownMenu。

## Technical Notes

* 关键文件: `Sidebar.tsx`, `SettingsDialog.tsx`, `AccountSettingsTab.tsx`
* 组件: `DropdownMenu` 已存在于 `components/ui/`
* 无 Avatar 组件 — 用首字母圆形 div 代替（Tailwind）
* 拆分 AccountSettingsTab → EditUsernameDialog, EditEmailDialog, EditPasswordDialog
* i18n: 现有 `settings.json` 翻译 key 可复用，新增 user menu 的 key
