# Design: Settings Dialog Split-Pane Layout

## Architecture

将 `SettingsDialog.tsx` 从「单列 Tabs（顶部 list + 下方内容，content 外框按 tab 切宽度）」改为「分栏 Tabs（左侧纵向 list + 右侧固定高内容区）」。

### 结构变更

```
DialogContent (sm:max-w-3xl, 固定宽度, 去掉外层 overflow-y-auto 与 transition-[max-width])
├── DialogHeader (标题 + 描述)          ← 固定，不随内容滚动
└── Tabs (mt-2, flex)
    ├── TabsList (orientation="vertical", flex-col, w-40, gap-1)   ← 左栏
    │   └── TabsTrigger × 5 (justify-start, 不再 flex-1)
    └── 内容区容器 (flex-1, min-w-0, max-h-[60vh], overflow-y-auto)  ← 右侧滚动区
        ├── TabsContent value="general"   (mt-0, px-6?)
        ├── TabsContent value="ai"
        ├── TabsContent value="subscriptions"
        ├── TabsContent value="automation"
        └── TabsContent value="about"
```

### 响应式：小屏降级（< `sm`）

- `DialogContent` 在 `< sm` 仍 `w-full`（shadcn 默认 `w-full max-w-lg`，我们用 `sm:max-w-3xl` 覆盖 max-w，宽度天然铺满）。
- 布局类用 `flex-col sm:flex-row`：
  - `< sm`：`TabsList` 横向（默认 `inline-flex h-10`）放顶部，`w-full`；内容区在下方。
  - `≥ sm`：`TabsList` `sm:flex-col sm:w-40 sm:h-auto`，纵向放左；内容区 `sm:flex-1` 在右。
- `TabsList` 的 `orientation` prop：Radix 用它做无障碍语义（arrow-key 方向），桌面端纵向传 `vertical`。但同一组件实例难以在断点间切换 prop，因此：
  - 采用「无条件渲染两个不同布局的 TabsList」会破坏 Radix 受控（同一 `Tabs` 下多个 `TabsList` 时 triggers 需共享 value，Radix 支持但 `orientation` 不同）。
  - **简化决策**：`TabsList` 始终传 `orientation="vertical"`，靠 className 切横/纵向排列：
    - `< sm` 横向：`flex w-full`（覆盖默认 `inline-flex h-10` 的纵向高度，triggers `flex-1`）。
    - `≥ sm` 纵向：`sm:flex-col sm:w-40 sm:h-auto`。
  - 代价：小屏下 `orientation` 仍为 vertical，键盘左右箭头语义不完美 → 可接受（小屏触屏为主，且 shadcn 默认 List 本身不传 orientation，行为一致）。**替代**：若坚持无障碍正确，用两个 `TabsList` 渲染（hidden/sm:block 切换），Radix 允许同 `Tabs` 内多个 List，triggers 的 value 唯一即可。**采用替代方案**以保无障碍正确，见下「TabsList 双渲染」。

### TabsList 双渲染（无障碍 + 响应式正确）

```
<Tabs>
  {/* 桌面纵向 */}
  <TabsList orientation="vertical" className="hidden sm:flex flex-col w-40 gap-1 h-auto justify-start">
    <TabsTrigger value="general" className="justify-start">…</TabsTrigger>
    …
  </TabsList>
  {/* 移动横向 */}
  <TabsList className="flex w-full sm:hidden">
    <TabsTrigger value="general" className="flex-1">…</TabsTrigger>
    …
  </TabsList>
  <div className="mt-4 sm:mt-0 sm:ml-6 sm:flex-1 min-w-0 sm:max-h-[60vh] sm:overflow-y-auto">
    {TabsContent × 5}
  </div>
</Tabs>
```

注：内容区容器在小屏不设 `max-h`/`overflow`（让 dialog 自然高度，小屏触屏滚动整页更顺手）；桌面端设 `sm:max-h-[60vh] sm:overflow-y-auto`。

## 数据流与契约

- 受控契约不变：`Dialog open=… onOpenChange=…`、`Tabs value=activeTab onValueChange=…`（实际由 `settingsDialogTab`/`setActiveTab` 驱动）。
- `settingsDialogTab` 外部跳转（如从外部按钮直跳 subscriptions）仍通过 `useEffect` 同步到 `activeTab`，逻辑不动。

## 内层滚动容器调和

外层内容区在桌面已有 `sm:max-h-[60vh] sm:overflow-y-auto`。各 tab 现有内层滚动：

| Tab | 现状内层滚动 | 处理 |
|---|---|---|
| Subscriptions | feed 列表 `max-h-[280px] overflow-y-auto` | 保留。`280px` + 上方类别/OPML 区可能超 60vh，此时外层滚动兜底。双层滚动可接受（内层是「列表局部」滚动，外层是「整个 tab 内容」滚动）。 |
| Automation | `ScrollArea max-h-[400px]` | 保留。`400px` 列表 + 顶部「新增」按钮，外层 `60vh` 兜底。 |

理由：内层滚动是为「长列表不顶出整个面板」而设，外层滚动是为「tab 内容整体不撑高 dialog」。两者职责不同，保留不冲突。若测试发现双层滚动体验差，备选：去掉内层 `max-h`，让外层统一滚。但默认保留现状，最小改动。

## 样式细节

- `DialogContent` 类：
  - 移除 `transition-[max-width] duration-150`、移除 `overflow-y-auto`、移除条件 `max-w-*`。
  - 新增/保留 `sm:max-w-3xl`、`max-h-[calc(100vh-4rem)]`（整体上限，防极高内容顶出视口）。
- Tabs 容器：`flex flex-col sm:flex-row gap-4`（`gap-4` 仅桌面；小屏用 `mt-4` 分隔 list 与内容）。
- `TabsTrigger` 桌面：`justify-start`；移动：`flex-1`。靠在各自 `TabsList` 渲染分支里给不同 className。
- `TabsContent`：去掉 `mt-4`（外层容器统一给 padding/gap），或保留 `mt-4 sm:mt-0`。
- About：内容居中（已是）即可，无需额外处理。

## 兼容性

- 不改 `dialog.tsx`。所有样式在 `SettingsDialog.tsx` 内通过 className 覆盖。
- 不改 reader store。
- i18n 不变。

## 风险与回滚

- 风险 1：`TabsList` 双渲染若 Radix 对同 `Tabs` 内多个 List 的 active 状态同步有问题。**缓解**：Radix 文档明确支持多个 `TabsList`，triggers 按 value 关联；实现后实测切换。
- 风险 2：纵向 `TabsList` 在极少内容时高度塌陷。**缓解**：`justify-start` + 不设固定高度。
- 回滚：改动集中在单文件 `SettingsDialog.tsx`，`git checkout` 即可恢复。

## 权衡记录

- 未选「`orientation` 单实例 + 响应式 className」是为了键盘无障碍语义正确（横向 List 应配 horizontal orientation 的左右箭头）。
- 未选「移动端用 Select 切 tab」是因为超出范围、过度设计。
