# 修复点击新文章提示后列表跳到底部空白

## Goal

修复文章列表在已加载多页、自动刷新出现新文章后，点击“有 X 篇新文章，点击查看”会跳到列表底部并显示空白的问题。点击后应使用缓存中的最新第一页重建列表，并在该数据提交给虚拟列表后稳定定位到第一篇文章。

## What I Already Know

- 问题位于前端 `ArticleList` 的新文章确认与 Virtuoso 滚动时序。
- 2026 年 6 月 7 日的提交 `1ad140a` 新增了点击提示后裁剪 infinite query 到第一页的逻辑。
- 当前处理函数在 React 和 React Query 更新提交前就调用 `scrollToIndex(0)`，该命令实际作用于裁剪前的长列表。
- 数据随后从多页骤减为一页时，Virtuoso 保留旧的深滚动偏移并落到新列表末端。
- 列表 Footer 固定包含接近一整屏的底部占位，用于让最后几篇文章滚过顶部并触发自动已读；旧偏移落入该区域后，界面看起来就是空白。
- 后端数据和第一页缓存仍存在，不是文章请求返回空数组。

## Assumptions

- 用户期望点击提示后立即看到最新第一页的第一篇文章。
- 顶部重置应为无动画的即时定位，避免和数据裁剪并发。
- 必须保留现有底部占位和滚动自动已读能力。
- 本次仅修复点击提示后的提交/滚动时序，不改变新文章检测和分页协议。

## Open Questions

- 无。用户已确认修复后的预期交互是“点击后立即定位到最新第一篇”。

## Requirements

### Data Reset

- 点击提示后继续只保留当前 query key 的最新第一页。
- `pages` 与 `pageParams` 必须同步裁剪。
- 第一页文章必须被确认并立即进入可见文章数组。
- 不为该操作额外发送重复的文章列表请求。

### Scroll Reset

- 不得在 Virtuoso 仍持有旧数据时执行最终滚动定位。
- 应先提交裁剪后的一页数据，再在浏览器绘制前将列表定位到索引 0。
- 使用 `align: "start"` 和 `behavior: "auto"`，避免长距离平滑滚动与数据替换冲突。
- 点击后不得短暂显示底部 Footer 空白区。

### Existing Behavior

- 保留 Footer 底部占位和滚动自动已读逻辑。
- 保留全部、未读、收藏及 feed 维度的查询隔离。
- 点击后继续从最新第一页的 `next_cursor` 加载后续页。
- 自动刷新出现新文章时，点击前不得改变当前滚动位置。

## Acceptance Criteria

- [ ] 已加载至少两页并滚动到较深位置时，点击新文章提示后第一篇最新文章出现在列表顶部。
- [ ] 点击后滚动条不落到底部，列表不显示整屏空白。
- [x] 当前 infinite query 只保留第一页，`pages` 与 `pageParams` 长度均为 1。
- [ ] 点击后继续下滚可从最新第一页的游标加载下一页，无跳页或重复。
- [ ] 全部与未读筛选下均不会回归。
- [x] Footer 占位与最后几篇文章的滚动自动已读能力保持不变。
- [x] 相关测试、lint、typecheck/build 通过。

## Definition of Done

- 完成最小范围实现和回归测试。
- 按前端组件、Hook、状态管理和类型规范检查。
- 在浏览器中验证多页深滚动后的点击流程。
- 评估是否需要补充 Virtuoso 数据替换与滚动时序规范。

## Out of Scope

- 删除或缩短底部 Footer 占位。
- 修改后端文章排序、游标或抓取调度。
- 修改提示条样式、文案或自动刷新间隔。
- 重构文章自动已读机制。

## Technical Notes

- 主要实现文件：`frontend/src/components/ArticleList.tsx`。
- 现有分页纯函数和测试位于 `frontend/src/lib/articleList.ts` 与 `frontend/src/lib/articleList.test.ts`。
- 研究记录：`research/current-behavior.md`。
- 推荐通过 pending reset ref/state 配合 `useLayoutEffect`，在裁剪后的文章数组提交后执行最终顶部定位。

## Verification

- `npm run test`: 9 tests passed.
- `npm run lint`: 0 errors; 10 pre-existing warnings in unrelated files.
- `npm run build`: passed; existing bundle-size warning remains.
- `git diff --check`: passed.
- The local Vite app returned HTTP 200.
- Visual deep-scroll reproduction was not run because the in-app browser instance was unavailable in this session.
