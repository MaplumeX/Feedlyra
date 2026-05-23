# Optimize Content Display UI

## Goal

优化 ArticleDetail 的阅读排版体验：修复缺失的 typography 插件、改善文章内容渲染质量、添加图片点击放大和字体大小调节功能。

## Requirements

* 安装并配置 `@tailwindcss/typography` 插件，使 `prose` 排版类生效
* 文章内图片自适应宽度（居中、随容器缩放）
* 图片点击放大（lightbox 全屏预览）
* 字体大小三档可调（小/中/大），偏好存储到 localStorage
* 代码块保持 typography 默认样式（不做语法高亮）
* 文章阅读宽度保持 `max-w-3xl`
* iframe/视频嵌入保持可交互，lightbox 不遮挡

## Acceptance Criteria

* [ ] `@tailwindcss/typography` 安装并配置，文章排版样式生效（标题、段落、列表、引用、代码块等）
* [ ] 文章内图片自适应容器宽度，居中显示
* [ ] 点击图片弹出 lightbox 全屏预览，ESC 或点击背景关闭
* [ ] 字体大小三档切换（小/中/大），默认中档，选择持久化到 localStorage
* [ ] iframe/视频嵌入不受 lightbox 影响，保持可交互
* [ ] AI 摘要框、翻译 badge 等不受排版优化影响
* [ ] Lint / typecheck / CI green

## Definition of Done

* Lint / typecheck / CI green
* 视觉效果可通过运行验证

## Technical Approach

1. 安装 `@tailwindcss/typography`，添加到 `tailwind.config.ts` plugins
2. 在 ArticleDetail 内对 `prose` 区域的 `<img>` 添加点击事件，弹出 lightbox overlay
3. 字体大小调节：在 reader store 添加 `fontSize` 状态（"sm" | "md" | "lg"），persist 到 localStorage，通过 prose 修饰类 `prose-sm` / `prose` / `prose-lg` 切换
4. 在 ArticleDetail 工具栏添加字体大小切换按钮

## Decision (ADR-lite)

**Context**: 文章排版类未生效因缺少 typography 插件；图片和字体大小是阅读体验的核心需求
**Decision**: 安装 typography + 自定义图片 lightbox + 字体大小三档 + prose 修饰类切换
**Consequences**: 引入 lightbox 需处理 iframe 交互边界；prose 修饰类方案简洁但档位有限（如需连续调节则需换方案）

## Out of Scope

* ArticleList 列表显示优化
* 代码块语法高亮
* 响应式/移动端布局
* 阅读主题切换（sepia 等）
* 文章宽度可调

## Technical Notes

* 关键文件：`frontend/src/components/ArticleDetail.tsx`, `frontend/tailwind.config.ts`, `frontend/src/stores/reader.ts`
* DOMPurify 配置在 ArticleDetail:79-82，已允许 img/figure/figcaption/iframe 等标签
* reader store 已有 persist middleware，可直接扩展 fontSize 字段
