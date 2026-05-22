# Settings Panel: Language Switch + AI Configuration

## Goal

在侧边栏底部添加设置按钮，点击打开 Dialog 模态弹窗，内含 Tabs 分组（通用 / AI），将语言切换和 AI 配置整合到统一入口，移除原侧边栏语言切换和 `/settings/ai` 路由。

## Requirements

* 侧边栏底部添加设置按钮（Settings 齿轮图标），替换原语言切换位置
* 点击设置按钮打开 Dialog 模态弹窗
* 设置弹窗内用 Tabs 分组：「通用」和「AI」
* 「通用」Tab：语言切换（en / zh-CN），复用现有 i18next 逻辑
* 「AI」Tab：Base URL、API Key、Model 三个字段 + Test Connection 按钮，复用现有 `useAIConfig()` / `useUpdateAIConfig()` hooks
* 移除侧边栏底部的语言切换 DropdownMenu
* 删除 `/settings/ai` 路由及 `AISettings.tsx` 页面

## Acceptance Criteria

* [ ] 侧边栏底部有设置按钮（齿轮图标）
* [ ] 点击按钮打开 Dialog 模态弹窗，弹窗内有「通用」「AI」两个 Tab
* [ ] 通用 Tab 可切换语言（en / zh-CN），切换即时生效
* [ ] AI Tab 可配置 Base URL、API Key、Model，可保存和测试连接
* [ ] 侧边栏底部不再有独立语言切换 DropdownMenu
* [ ] `/settings/ai` 路由已移除，`AISettings.tsx` 已删除
* [ ] i18n strings 完整（en + zh-CN）
* [ ] 暗色模式 UI 正常

## Definition of Done

* Lint / typecheck / CI green
* 组件复用 shadcn/ui（Dialog, Tabs, Input, Button, Label 等）
* i18n strings 补充完整（en + zh-CN）
* 暗色模式下 UI 表现正常

## Out of Scope

* 不新增语言（仅迁移现有的 en / zh-CN）
* 不修改后端 AI 配置 API
* 不添加新的 AI 功能（如新模型、新操作）
* 不做主题切换、通知设置等其他通用设置项

## Decision (ADR-lite)

**Context**: 需要为语言切换和 AI 配置提供统一入口，取代分散的侧边栏语言切换和独立 `/settings/ai` 页面。

**Decision**:
1. 设置面板形式 → Dialog 模态弹窗（而非 Sheet 侧滑面板或独立页面）
2. 设置按钮位置 → 侧边栏底部（替换原语言切换位置）
3. 内部分组 → Tabs（「通用」/ 「AI」），预留扩展
4. 路由处理 → 直接删除 `/settings/ai` 路由和 `AISettings.tsx`

**Consequences**: Dialog 空间适中但有限，Tabs 分组便于后续新增设置分类；删除旧路由需确认无外部链接依赖。

## Technical Approach

1. 新建 `SettingsDialog.tsx` 组件，使用 shadcn/ui `Dialog` + `Tabs`
2. 从 `Sidebar.tsx` 提取语言切换逻辑到 `GeneralSettingsTab.tsx`
3. 从 `AISettings.tsx` 提取 AI 配置表单到 `AISettingsTab.tsx`
4. 在 `Sidebar.tsx` 底部将语言切换替换为设置按钮
5. 在 `reader.ts` Zustand store 中添加 `settingsDialogOpen` 状态
6. 删除 `AISettings.tsx` 页面和 `/settings/ai` 路由
7. 补充 i18n strings

## Technical Notes

* `Sidebar.tsx` — 当前语言切换位置，需替换为设置按钮
* `AISettings.tsx` — 当前 AI 配置页面，需删除
* `App.tsx` — 路由配置，需移除 `/settings/ai` 路由
* `reader.ts` (Zustand store) — 添加 `settingsDialogOpen` 状态
* `api/hooks.ts` — `useAIConfig()` / `useUpdateAIConfig()` hooks，复用
* `i18n/index.ts` — i18next 配置，复用
* `components/ui/dialog.tsx` — shadcn/ui Dialog 组件
* `components/ui/tabs.tsx` — shadcn/ui Tabs 组件