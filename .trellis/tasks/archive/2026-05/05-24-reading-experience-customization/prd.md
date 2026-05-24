# 阅读体验自定义：排版参数可调

## Goal

让用户在文章阅读视图中通过工具栏 popover 面板实时调整排版参数（字号、字体、行高、内容区宽度、字间距、段落间距），提升阅读舒适度。

## Requirements

* 6 项可调参数：
  - **字号**：连续滑块（范围待定，如 14px–24px）
  - **字体**：下拉选择，5–8 种精选字体（含衬线/无衬线/中文友好字体），带 fallback
  - **行高**：连续滑块（如 1.4–2.2）
  - **内容区宽度**：连续滑块（如 640px–960px）
  - **字间距**：连续滑块（如 0–0.1em）
  - **段落间距**：连续滑块（如 0.5em–2em）
* UI 交互：工具栏 popover，替代原字号循环按钮（Type 图标），在按钮附近弹出
* 所有参数实时预览，调整即生效
* 所有设置通过 Zustand persist 持久化到 localStorage
* AI 翻译内容也受排版设置影响（同一 prose 容器，自动生效）

## Acceptance Criteria

* [ ] 字号滑块调整生效，持久化，默认值与当前 prose-md 一致
* [ ] 字体下拉选择生效，持久化，含 fallback
* [ ] 行高滑块调整生效，持久化
* [ ] 内容区宽度滑块调整生效，持久化
* [ ] 字间距滑块调整生效，持久化
* [ ] 段落间距滑块调整生效，持久化
* [ ] 原 Type 循环按钮改为 popover 触发按钮
* [ ] popover 面板含 6 项控件，紧凑不遮挡正文
* [ ] 切换文章后设置保持
* [ ] 深色模式下面板和排版正常
* [ ] "重置为默认"按钮恢复所有参数

## Definition of Done

* 所有设置持久化到 localStorage
* 切换文章后设置保持
* 深色模式下正常工作
* Lint / typecheck 通过
* 实时预览效果

## Decision (ADR-lite)

**Context**: 需要确定 UI 交互方式和参数范围
**Decision**: 工具栏 popover（替代原字号循环按钮），6 项参数，连续滑块 + 字体下拉
**Consequences**: 原 3 档循环字号被滑块替代，需迁移旧 fontSize 状态；prose 类的排版由 CSS 自定义属性覆盖

## Out of Scope

* 文章列表区域的排版调整
* 后端同步设置
* 文字颜色/背景色自定义
* 连字设置等高级排版

## Technical Approach

1. **Reader store 扩展**：在 `reader.ts` 新增 `readerSettings` 对象（fontSize, fontFamily, lineHeight, contentWidth, letterSpacing, paragraphSpacing），加入 persist partialize
2. **Popover 组件**：新建 `ReadingSettingsPopover`，使用 shadcn Popover + Slider + Select
3. **ArticleDetail 改造**：
   - 替换原 Type 循环按钮为 Popover 触发按钮
   - 移除 prose 尺寸类（prose-sm/prose/prose-lg），改用内联 style 覆盖 CSS 自定义属性
   - 内容区 max-w 改为受控值
4. **CSS 覆盖策略**：通过 prose 容器的内联 style 设置 `--tw-prose-font-size`、`--tw-prose-line-height` 等 CSS 变量，或直接用 style 属性覆盖

## Technical Notes

* 文章排版受 `@tailwindcss/typography` prose 类控制，自定义字号/行高需覆盖 prose 的 CSS 变量或使用内联样式
* 字体选择需要加载 web 字体或依赖系统字体，需配置 font-family fallback 栈
* Reader store 路径: `frontend/src/stores/reader.ts`
* ArticleDetail 路径: `frontend/src/components/ArticleDetail.tsx`
* SettingsDialog 路径: `frontend/src/components/settings/SettingsDialog.tsx`
