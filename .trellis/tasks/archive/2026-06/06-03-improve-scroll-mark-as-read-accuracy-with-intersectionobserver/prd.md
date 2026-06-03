# Improve Scroll Mark-as-Read Accuracy

## Goal

用 IntersectionObserver 替换 Virtuoso rangeChanged 来判定"文章滚出视口"，解决当前纯索引判定过于宽松、文章只剩残影却不标记已读的问题。

## Decisions

* **阈值策略**：rootMargin 抵消 header + threshold: 0 — 文章顶部一旦触及 header 底部线就标记已读（Feedly/Inoreader 风格，"露出即过"）
* **Observer 管理**：ArticleList 组件层创建单例 IntersectionObserver（useRef），通过 Virtuoso `components.Item` 自定义组件在 mount 时 observe、unmount 时 unobserve
* **完全替换 rangeChanged**：移除 rangeChanged 回调及其相关状态（prevRangeRef、isStableRef），IntersectionObserver 完全承担判定职责，避免两套逻辑冲突

## Requirements

* 文章顶部触及判定线（header 底部）时标记已读 — Feedly "露出即过"风格
* 44px header 高度通过 IntersectionObserver rootMargin 抵消，不干扰判定
* NewArticlesBanner 显示时不干扰判定（observer root 指向 Virtuoso 滚动容器，banner 在容器外）
* 向上滚动不标记已读（仅当 isIntersecting 从 true→false 且 boundingClientRect.top < rootBounds.top 时触发）
* 保持现有防抖 300ms + batch-read API 架构不变
* 设置开关关闭时 IntersectionObserver 仍 observe 但回调不触发标记

## Acceptance Criteria

* [ ] 文章顶部触及 header 底部线时标记已读
* [ ] header 区域不影响判定精度（rootMargin: '-44px 0px 0px 0px'）
* [ ] 向上滚动不标记已读
* [ ] 快速滚动时防抖仍然正常工作（300ms debounce + batch-read）
* [ ] 设置开关关闭时滚动不触发标记已读
* [ ] Virtuoso 虚拟化回收 DOM 时不泄漏 observer、不误标记
* [ ] NewArticlesBanner 显示时判定精度不受影响

## Definition of Done

* Lint / typecheck 通过
* 手动测试验证精度改善
* 无回归（现有标记已读功能不受影响）

## Technical Approach

1. **创建单例 IntersectionObserver**：在 ArticleList 组件中用 useRef 持有，配置 `rootMargin: '-44px 0px 0px 0px'`、`threshold: 0`，root 指向 Virtuoso 的滚动容器（通过 scrollerRef 获取）
2. **自定义 Virtuoso Item 组件**：在 `components.Item` 中用 ref callback 将 DOM 元素 observe，unmount 时 unobserve。通过 data attribute（`data-article-id`）将 article ID 关联到 DOM 元素
3. **observer callback 逻辑**：当文章从可见→不可见（isIntersecting: true→false）且 boundingClientRect.top < rootBounds.top（滚出上方）时，将 article ID 加入 pendingIdsRef，触发防抖
4. **移除 rangeChanged**：删掉 rangeChanged 回调及 prevRangeRef、isStableRef、相关的 useEffect 重置逻辑
5. **复用现有防抖**：pendingIdsRef + debounceTimerRef + flushPendingIds 保持不变

## Out of Scope

* 阅读进度恢复
* 文章详情内的滚动标记已读
* 停留延迟策略

## Technical Notes

* 核心文件：frontend/src/components/ArticleList.tsx
* 相关 hooks：frontend/src/api/hooks.ts (useBatchRead)
* 存储设置：frontend/src/stores/reader.ts (scrollMarkRead)
* 原始 PRD：.trellis/tasks/archive/2026-05/05-23-scroll-mark-read/prd.md
