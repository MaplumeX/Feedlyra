# 获取全文按钮始终显示在工具栏

## Goal

将"获取全文"按钮从文章内容区的无内容回退区域移到顶部工具栏，使其无论文章是否已有内容都可见可操作。

## What I already know

* 按钮当前定义在 `ArticleDetail.tsx` L282-294，仅当 `sanitizedContent` 为空时显示
* 工具栏在 `ArticleDetail.tsx` L139-201，包含 star/read/summarize/translate/chat/settings/external-link
* 工具栏按钮统一使用 `variant="ghost" size="icon" className="h-8 w-8"` 样式
* `extractContent` mutation 已存在，按钮逻辑可复用
* `FileText` 图标已被当前按钮使用

## Requirements

* 将"获取全文"按钮移入工具栏（AI 按钮组之后、ReadingSettingsPopover 之前）
* 按钮始终可见，不受 `sanitizedContent` 状态限制
* 按钮样式与工具栏其他 icon 按钮一致（ghost, icon, h-8 w-8）
* 提取中显示 loading 状态（animate-spin）
* 移除内容区无内容回退块中的按钮，仅保留文本提示

## Acceptance Criteria

* [ ] 工具栏中显示"获取全文"icon 按钮，始终可见
* [ ] 按钮点击后调用 extractContent.mutate，成功后文章内容更新
* [ ] 提取中按钮显示 loading 动画 + disabled
* [ ] 无内容回退区不再显示"获取全文"按钮，仅保留文本提示
* [ ] 文章已有内容时，按钮仍可点击（始终可点击，允许重新提取覆盖）

## Definition of Done

* Lint / typecheck 通过
* 手动验证：有内容/无内容两种场景按钮行为正确

## Out of Scope

* 提取内容的后端逻辑变更
* 工具栏的其他重构

## Technical Notes

* 文件: `frontend/src/components/ArticleDetail.tsx`
* 按钮使用 `FileText` 图标，提取中可用 `animate-spin` 或 `Loader2`
* 需添加 `title` 属性以保持与工具栏其他按钮一致的 tooltip 行为
