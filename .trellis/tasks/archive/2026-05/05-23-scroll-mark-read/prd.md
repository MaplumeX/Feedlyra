# Scroll Mark Read

## Goal

在文章列表中滚动时，自动将滚出视口的文章标记为已读，减少用户手动标记的负担。

## What I already know

* 文章列表使用 react-virtuoso (Virtuoso) 进行虚拟滚动渲染
* 已读/未读状态通过后端 ReadStatus 表管理（有则已读，无则未读）
* 当前标记已读的方式：点击选中、j 键下一个、详情栏手动切换、全部标记已读
* useToggleRead() 逐篇调用 PUT /api/articles/{id}/read
* useMarkAllRead() 批量调用 PUT /api/articles/mark-all-read
* ArticleList 中无任何滚动事件监听或 IntersectionObserver
* Virtuoso 支持 rangeChanged 回调，可获取当前可见范围
* "未读"筛选 tab 下，文章标记已读后需从列表移除，可能导致滚动跳动

## Decisions

* **触发策略**：文章完全离开视口上方时标记已读（Feedly 经典行为）
* **API 策略**：后端新增批量标记已读 API `PUT /api/articles/batch-read`，接受 `article_ids: UUID[]`
* **用户控制**：默认开启，提供设置开关让用户关闭此功能
* **边界保护**：resize/初始化不误触发；未读 tab 下标记后列表平滑更新

## Open Questions

* (无)

## Requirements

* 用户在文章列表中向下滚动时，已滚过（离开视口上方）的未读文章自动标记为已读
* 后端新增 `PUT /api/articles/batch-read` 接口，一次请求可标记多篇已读
* 前端防抖收集待标记文章 ID，批量调用 API
* 设置中提供"滚动标记已读"开关，默认开启
* "未读"筛选 tab 下，标记已读的文章需平滑从列表移除，不导致滚动位置跳动
* resize/初始化时 Virtuoso 的 rangeChanged 不应误触发标记

## Acceptance Criteria

* [ ] 向下滚动时，离开视口上方的未读文章自动标记为已读
* [ ] 向上滚动不会改变文章已读状态
* [ ] 快速滚动时不会产生过多 API 请求（防抖 + 批量 API）
* [ ] 已读状态变化后文章列表和侧栏未读计数同步更新
* [ ] 后端 batch-read API 正确处理幂等场景
* [ ] 设置开关关闭时，滚动不会触发标记已读
* [ ] 设置开关状态持久化
* [ ] "未读"tab 下标记已读后列表平滑更新，无跳动

## Definition of Done

* Lint / typecheck 通过
* 手动测试验证功能正常
* 无回归（现有标记已读功能不受影响）

## Out of Scope

* 阅读进度恢复（记住滚动位置）
* 文章详情内的滚动标记已读
* 停留延迟策略（N 秒后才标记）

## Technical Approach

1. **后端**：新增 `PUT /api/articles/batch-read`，接受 `{ article_ids: UUID[] }`，批量插入 ReadStatus 行（忽略已存在的）
2. **前端滚动检测**：使用 Virtuoso 的 `rangeChanged` 回调追踪可见范围，记录上一次范围。新范围 startIndex 小于上次 startIndex 时，其间的未读文章加入待标记队列
3. **前端防抖**：待标记队列通过 debounce（~300ms）合并后调用 batch-read API
4. **前端设置**：reader store 新增 `scrollMarkRead` 布尔值，persist 到 localStorage
5. **未读 tab 处理**：标记已读后 React Query 失效刷新文章列表，Virtuoso 的 `followOutput` 保持滚动位置

## Technical Notes

* react-virtuoso 的 rangeChanged 回调可获取当前可见 item 范围
* 后端新增 PUT /api/articles/batch-read，接受 { article_ids: UUID[] }
* 前端设置开关存入 reader store，使用 Zustand persist 中间件持久化
* 文件：frontend/src/components/ArticleList.tsx, frontend/src/api/hooks.ts, frontend/src/stores/reader.ts, backend/app/routers/articles.py, backend/app/schemas/article.py
