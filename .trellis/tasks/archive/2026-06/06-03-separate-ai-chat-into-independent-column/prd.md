# Separate AI Chat into Independent Column

## Goal

将 AI 对话面板从文章详情区的子面板提升为整体布局中的独立一栏，使其不再压缩文章阅读空间。

## Requirements

* AI Chat 面板成为主布局的第四栏（Sidebar | Article List | Article Detail | AI Chat）
* 按需显示：默认隐藏，点击按钮后从右侧展开
* 无选中文章时按钮禁用，不允许打开 Chat
* 切换文章时 Chat 栏保持打开，自动加载新文章的对话记录
* 文章取消选中时 Chat 栏自动关闭
* 打开/关闭 Chat 不影响文章详情区的宽度
* Chat 面板可拖拽调整大小（min 280px, max 600px）
* Chat 面板宽度持久化到 localStorage

## Acceptance Criteria

* [ ] Chat 作为布局顶层面板存在，不再是 ArticleDetail 的子面板
* [ ] 打开 Chat 不压缩文章详情区宽度
* [ ] Chat 面板可拖拽调整大小
* [ ] 无文章时 Chat 按钮禁用
* [ ] 取消选中文章时 Chat 栏自动关闭
* [ ] 切换文章时 Chat 栏保持打开并加载对话
* [ ] 现有快捷键和 Command Palette 访问方式保持工作
* [ ] 面板大小持久化到 localStorage

## Definition of Done

* Lint / typecheck / CI green
* 现有功能无回归

## Technical Approach

1. **布局改造**：在 `Home.tsx` 的顶层 `PanelGroup` 中添加第四个 `Panel`，条件渲染 `AIChatPanel`（当 `chatPanelOpen && selectedArticle` 时显示）
2. **从 ArticleDetail 中移除**：删除 `ArticleDetail.tsx` 中的嵌套 `PanelGroup`（chat 相关部分），ArticleDetail 只保留文章内容
3. **Store 调整**：保持 `chatPanelOpen` 和 `chatPanelWidth` 状态，调整 open/close 逻辑（无文章时不可打开，取消选中时自动关闭）
4. **持久化**：利用 `react-resizable-panels` 的 auto-save-id 机制，第四栏尺寸自动持久化

## Out of Scope

* 非 per-article 的通用对话功能
* Chat 栏的拖拽分离/浮动窗口
* 多 Tab 对话

## Technical Notes

* 布局使用 `react-resizable-panels`，支持嵌套 Group
* 面板大小已持久化到 localStorage (`providence-layout`)
* Chat 面板宽度已在 store 中有 `chatPanelWidth` 状态
* 相关文件：`AIChatPanel.tsx`, `ArticleDetail.tsx`, `Home.tsx`, `stores/reader.ts`, `CommandPalette.tsx`
