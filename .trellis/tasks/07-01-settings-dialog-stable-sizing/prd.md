# Redesign settings dialog for stable sizing across tabs

## Goal

Settings dialog 当前在切换 tab 时宽高都在抖动，体验差。重新设计为**左侧 tab 导航 + 右侧固定内容区**的分栏布局（类似 macOS 设置窗），让 dialog 尺寸在所有 tab 间保持稳定，内容超出时在右侧内容区内部滚动，而不是整个 dialog 撑高/缩宽。

## Design Decision

采用**分栏布局（方案 C）**：左侧纵向 tab list，右侧内容区固定宽高、内部滚动。

理由：直接命中「切 tab 时尺寸抖动」核心痛点，且是一次真正的重新设计，体验最佳、尺寸最稳、未来扩展 tab 也容易。代价是改动较大、需要 `design.md` + `implement.md`，风险高于方案 A/B 但可接受。

## Background

### 现状（`frontend/src/components/settings/SettingsDialog.tsx`）

`DialogContent` 的 `className` 按 `activeTab` 动态切宽度：

```tsx
className={`transition-[max-width] duration-150 max-h-[calc(100vh-4rem)] overflow-y-auto ${
  activeTab === "subscriptions" ? "sm:max-w-2xl"        // 672px
  : activeTab === "automation" ? "sm:max-w-xl"          // 576px
  : "sm:max-w-[480px]"                                    // 480px
}`}
```

问题：
- 宽度三档跳变（480 / 576 / 672），切 tab 时 `transition-[max-width]` 会有可见的宽变动画。
- 整个 `DialogContent` `overflow-y-auto`，高度也随各 tab 内容长短变化。
- About 这种很窄的内容在 480px 容器里还算稳，但 Subscriptions 内容多时高度会一直撑到 `100vh-4rem`。

### 各 tab 实际尺寸需求（已读源码确认）

| Tab | 文件 | 内容特点 | 当前宽度档 |
|---|---|---|---|
| General | `GeneralSettingsTab.tsx` | 语言/主题/聊天模式按钮组 + 一个开关 | 480px |
| AI | `AISettingsTab.tsx` | 表单（base_url/key/model）+ 3 个可展开区块，高度可变 | 480px |
| Subscriptions | `SubscriptionsTab.tsx` | 类别 chip + feed 列表（内部已有 `max-h-[280px]` 滚动）+ OPML 导入导出，最宽最高 | 672px |
| Automation | `AutomationTab.tsx` | 规则卡片列表，内部已有 `ScrollArea max-h-[400px]` | 576px |
| About | `AboutTab.tsx` | 居中文本，很窄 | 480px |

### 相关 spec

- `.trellis/spec/frontend/component-guidelines.md` 第 73-76 行：Dialog 组件遵循 shadcn `open`/`onOpenChange` 模式。
- 无专门约束 settings dialog 尺寸的 spec 条目。

## Requirements

### 交互与布局决策（已确认）

- **布局**：`sm` 及以上为分栏——左侧纵向 tab list（`TabsList` 传 `orientation="vertical"` + `flex-col gap-1`，纯文字，固定 `w-40` ≈ 160px），右侧内容区固定高、内部滚动。
- **小屏降级**（< `sm`）：回退到顶部横向 `TabsList`（`w-full`）+ 下方内容区，dialog 仍 `w-full`。
- **尺寸**：dialog 外框统一 `sm:max-w-3xl`（768px）；右侧内容区统一 `max-h-[60vh] overflow-y-auto`；`DialogHeader`（标题+描述）固定不随内容滚动。
- **Tab 视觉**：纯文字，无图标，与现有 Tab 风格一致。
- 移除 `transition-[max-width]`（不再为宽度跳变服务）。

### 功能需求

- 切换 tab 时 dialog 外框宽高都不变化。
- 内容超出由右侧内容区统一滚动承载。
- `sm` 及以上：左栏纵向 tab 导航；`sm` 以下：顶部横向 tab 降级。
- 各 tab 内部原有的滚动容器（Subscriptions feed 列表 `max-h-[280px]`、Automation `ScrollArea max-h-[400px]`）需要重新规划：外层内容区已有 `max-h-[60vh]` 滚动，内层固定 `max-h` 可能造成双层滚动嵌套，需调和（见 design.md）。
- About tab 在固定 768px 宽容器内居中协调。

### 非功能需求

- 不破坏现有 shadcn Dialog / Tabs 的 `open`/`onOpenChange`、`value`/`onValueChange` 受控契约。
- 保持 `i18next` 文案不变。
- 保持响应式：小屏幕（< `sm`）回退顶部 Tabs + 铺满。
- 不改 `dialog.tsx` 基础组件（按需在 SettingsDialog 层覆盖样式即可）。
- 不重写各 tab 内部内容/交互逻辑，仅调整容器/滚动相关 className。
- 不调整 reader store 中 `settingsDialogTab` 受控状态机。

## Acceptance Criteria

- [ ] 在 General / AI / Subscriptions / Automation / About 五个 tab 之间切换时，dialog 外框宽度不变化。
- [ ] 切换 tab 时 dialog 高度不出现明显抖动（统一高度策略下，各 tab 自行内部滚动）。
- [ ] Subscriptions tab 的 feed 列表仍可内部滚动；Automation tab 的规则列表仍可内部滚动。
- [ ] About tab 在统一的（较宽）容器内视觉协调（居中即可）。
- [ ] `pnpm lint` 与 `pnpm type-check`（frontend）通过。

## Out of Scope

- 不重写各 tab 的内部内容/交互逻辑。
- 不调整 `task.py` / reader store 中 `settingsDialogTab` 受控状态机。
- 不改 `dialog.tsx` 基础组件（除非必须）。

## Open Questions

（无——关键决策已全部与用户确认：分栏方案、小屏降级、尺寸、Tab 视觉。剩余为 design.md 实现细节。）
