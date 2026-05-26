# AI摘要区域支持Markdown渲染

## Goal

让AI摘要区域支持Markdown渲染，使LLM生成的Markdown格式内容（列表、加粗、链接等）能正确显示为富文本，而非纯文本符号。

## What I already know

* AI摘要当前在 `ArticleDetail.tsx` 中以纯文本渲染：`<p className="text-sm whitespace-pre-wrap">{article.summary}</p>`
* 后端LLM prompt要求生成"3-5 bullet points"，输出很可能包含markdown语法（`-`/`*`/`**`等）
* 项目无任何markdown渲染库
* 项目已有 `@tailwindcss/typography`（prose类）和 `dompurify`（HTML消毒）
* AI Chat面板中的助手消息也是纯文本渲染，面临同样问题
* 技术栈：React 19 + Vite 6 + Tailwind CSS 3 + Zustand 5

## Assumptions (temporary)

* 仅需支持摘要区域的markdown渲染，Chat面板可后续迭代
* LLM输出的markdown是标准markdown（无特殊扩展语法）
* 无需支持代码块语法高亮

## Decisions

**库选择：marked + DOMPurify + prose**
* 原因：零依赖、与现有article content渲染模式一致、轻量
* 后果：需dangerouslySetInnerHTML（摘要区域无影响），Chat流式渲染也更友好

**范围：摘要 + Chat面板一起做**
* 原因：一次到位，Chat助手回复同样受益于markdown渲染

## Open Questions

(none)

## Requirements

* AI摘要区域将markdown文本渲染为富文本
* AI Chat面板的助手消息将markdown文本渲染为富文本
* 保持现有摘要/Chat区域的视觉风格一致
* 复用项目已有的DOMPurify + prose模式

## Acceptance Criteria

* [ ] 摘要中的markdown列表、加粗、斜体等语法正确渲染
* [ ] Chat面板助手消息中的markdown语法正确渲染
* [ ] 渲染后视觉风格与文章内容区域协调
* [ ] 无XSS安全风险（DOMPurify消毒）
* [ ] marked作为唯一新增运行时依赖

## Definition of Done

* Lint / typecheck / CI green
* 无安全漏洞（HTML注入/XSS）

## Out of Scope

* 代码块语法高亮
* markdown编辑器/预览功能
* SSE流式增量解析（Chat流式消息用marked全量解析即可）
* GFM表格/任务列表特殊处理（marked内置支持，无需额外工作）

## Implementation Plan

* PR1: 安装marked依赖 + 创建MarkdownContent通用组件 + 摘要区域接入 + Chat面板接入

## Research References

* [`research/markdown-libs.md`](research/markdown-libs.md) — React生态4大markdown库对比

## Research Notes

### 可行方案

**方案A：marked + DOMPurify + prose**（推荐）

* 原理：`marked` 解析markdown → HTML字符串 → DOMPurify消毒 → `dangerouslySetInnerHTML` 渲染到 prose 容器
* 优势：零依赖（464KB / 1包），极快，与项目现有 article content 渲染模式完全一致（DOMPurify + prose + dangerouslySetInnerHTML），无需引入85个包
* 劣势：需要 dangerouslySetInnerHTML，丢失 React 虚拟DOM diffing（对摘要区域无影响）
* 项目已有 DOMPurify 可直接复用

**方案B：react-markdown + remark-gfm**

* 原理：原生React组件，输出React元素，无需 dangerouslySetInnerHTML
* 优势：React原生渲染，默认安全（不渲染原始HTML），remark/rehype插件生态丰富
* 劣势：依赖树重（85包 / 7.9MB node_modules），ESM-only，v10移除了className prop

**排除选项**：snarkdown（已停止维护6年），markdown-it（比marked重且无优势）

### 约束

* 摘要区域文本量小，性能差异可忽略
* 项目已有 DOMPurify + prose 成熟模式
* Chat面板如需支持，marked的HTML字符串模式对SSE流式渲染更友好（可增量解析）

## Technical Notes

* 摘要渲染位置：`frontend/src/components/ArticleDetail.tsx` L242-253
* Chat渲染位置：`frontend/src/components/AIChatPanel.tsx` L148
* 已有依赖：`@tailwindcss/typography`（prose）、`dompurify`
* 后端prompt：`llm.py` L19-24，要求"3-5 bullet points"
