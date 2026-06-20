# Polish Floating AI Chat Panel UI

## Goal & User Value

全面打磨悬浮 AI 对话界面（floating 模式），同时保持 sidebar 模式一致性。目标：减少冗余结构、提升视觉精致度、改善悬浮交互体验，让 floating 面板更像一个精心设计的独立小窗。

## Confirmed Facts (from codebase inspection)

### 结构
- `chatPanelMode: "sidebar" | "floating"` 控制两种渲染形态（`stores/reader.ts`）
- **sidebar 模式**：`<Panel><AIChatPanel/></Panel>` — AIChatPanel 自带 header（History 按钮 + 标题 + 固定/关闭）
- **floating 模式**：`<FloatingChatPanel><AIChatPanel/></FloatingChatPanel>` — FloatingChatPanel 渲染一个 `h-10` 拖拽标题栏（仅显示 `t("chatPanel")` 文字，无功能按钮），其下再渲染 AIChatPanel（含其自己的 header） ⇒ **双标题栏堆叠**，floating 模式专属的空间浪费

### FloatingChatPanel 现状（`FloatingChatPanel.tsx`）
- 通过 `createPortal` 挂到 `document.body`，`position: fixed`
- 拖拽：header 区域 pointer 事件（`pointerdown/move/up`）；缩放：`getResizeEdge` 检测内侧 6px 边缘（4 边 + 4 角）
- 最小尺寸 280×300；默认尺寸 380×500（`DEFAULT_FLOATING_SIZE`）
- 位置/尺寸持久化到 Zustand（`floatingPanelPosition` / `floatingPanelSize`），含 window resize clamp
- **非 modal**：无 backdrop、无点击外部关闭（spec 明确要求保持）
- 视觉：`overflow-hidden rounded-lg border bg-background shadow-xl`

### AIChatPanel 现状（`AIChatPanel.tsx`）
- header：History popover + 标题 + PinOff/Pin 切换 + 关闭
- reference tags 横条（`border-b px-3 py-1.5`）
- 消息列表：`ScrollArea` + `space-y-5 px-3 py-3`，ChatGPT 风格对齐（user 右侧 pill `bg-chat-user`，assistant 左侧无气泡 + avatar）
- 空状态：`ChatEmptyState`（图标 + 标题 + 2×2 建议按钮）
- 输入：`ChatInput`（auto-resize textarea + 附件 + 发送/停止），`border-t p-3`，focus `ring-primary/20`
- 已有动画：`animate-in fade-in slide-in-from-bottom-2`（每条消息，注意 spec 警告：历史消息挂载会重复动画）
- typing indicator（3 bouncing dots，`chat-typing-dot` 定义在 index.css）
- hover actions（copy/edit/regenerate，`opacity-0 group-hover:opacity-100`）

### 设计 token / 约束（`index.css` + spec）
- 语义变量：`--chat-bubble-user`、`--chat-bubble-ai`、`--conversation-*`（light + dark）
- 颜色方案预设：indigo / amber / forest，会覆盖 brand 相关变量（含 `--chat-bubble-user`）
- 字体：`--font-ui`（Onest）、`--font-heading`（Space Grotesk）
- 全局 color transition 150ms
- shadcn/ui primitives + Tailwind inline，`cn()` 合并类
- 复用组件：`Button`、`Badge`、`ScrollArea`、`Popover`、`Separator`

### i18n 键（`reader.json`）
已有：`chatPanel`、`aiChat`、`switchToFloating`、`switchToSidebar`、`closeChat`、`chatPlaceholder`、`chatEmptyTitle/Subtitle` 等中文/英文双语。

## Decisions (resolved during brainstorm)

### D1. 双标题栏合并方案：方案 A（合并为单一 header，拖拽注入 AIChatPanel header）

- FloatingChatPanel 不再渲染自己的 `h-10` 标题栏，只保留容器定位 + 8 方向缩放 + `cursor` 切换
- AIChatPanel 增加一个 `draggable?: boolean`（或 Props 注入方式），floating 模式下让 header 区域成为拖拽手柄（`cursor-grab active:cursor-grabbing`）
- header 内的功能按钮（History popover / Pin / Close）通过 `onPointerDown={(e) => e.stopPropagation()}` 阻止冒泡，避免点按钮时误触发拖拽
- sidebar 模式不传 draggable，header 行为完全不变
- 收益：header 一处定义、两种模式复用，floating 模式消息区垂直空间多出 ~40px

### D2. 拖拽手柄可见性：方案 A（隐式手柄 + hover 反馈，不加常驻 grip 图标）

- floating 模式下整个 header 标题区作为拖拽区，`cursor-grab`（hover）/ `active:cursor-grabbing`（按下）
- 不加常驻 grip 图标，保持 header 与 sidebar 模式视觉一致
- discoverability 依赖 cursor 变化即可（与 macOS 原生窗口体感一致）
- sidebar 模式 header 无拖拽行为，cursor 不变

### D3. 缩放手柄可见性：方案 A（hover 时显现边缘/角落高亮，平时不可见）

- 平时（非 hover、非缩放过程中）：完全不可见，保持干净
- 鼠标进入面板边缘 6px 区域（复用现有 `hoveredEdge` 状态）：在对应边/角渲染 1px 半透明高亮线（`bg-primary/30`），与 cursor 变化同步出现
- 拖拽缩放过程中：高亮加深到 `bg-primary/50`，给明确反馈
- 实现复用现有 `hoveredEdge` state，容器内加 4 边 + 4 角 overlay div 控制 opacity

### D4. 尺寸校准：默认 420×560，最小 320×420

- 默认尺寸：`DEFAULT_FLOATING_SIZE` 从 380×500 调整为 420×560
  - 宽 420：2×2 建议按钮不换行 + 消息气泡 max-w-[85%] 更舒展
  - 高 560：合并 header 后留 ~400px 消息区，约 8 条短消息
- 最小尺寸：`MIN_WIDTH/MIN_HEIGHT` 从 280×300 调整为 320×420
  - 宽 320：保证 2 列建议按钮 + 单气泡不挤压
  - 高 420：扣除 header+reference+输入区 ~160px，消息区仍 ≥260px
- 仅影响未自定义过的用户（已持久化位置/尺寸的用户保持原值）

### D5. 阴影与边框层级：方案 A（动态阴影层级 + 失焦降饱和）

- 聚焦态（`:focus-within` 或轻量 state）：`shadow-2xl ring-1 ring-primary/10`，轻微抬起感
- 失焦态（鼠标移出且无焦点）：`shadow-xl`，略降存在感
- 边框保留 `border`，圆角从 `rounded-lg` 升级到 `rounded-xl`
- 实现纯 CSS（`:focus-within` + transition），无需新增 state；失焦降饱和可选项

### D6. 消息列表与空状态精致度：方案 A（适度精修 + 修复入场动画 bug）

- 消息间距：`space-y-5` → `space-y-4`（更紧凑但区分仍清晰），padding `px-3 py-3` → `px-4 py-4`（更内聚）
- 入场动画：修复 spec 已知 bug — 只对「新追加」的消息应用 `animate-in`（用 ref 追踪已渲染过的消息 id 集合），历史挂载/切换对话时不重复动画
- 空状态：保持现有图标 + 标题 + 2×2 建议，icon 容器可略微调优，建议按钮 `-translate-y-0.5` 微动效保留
- 影响范围：sidebar + floating 共享 AIChatPanel，改动是「都变好」，保持两种模式视觉基础一致

### D7. 输入框精致度：方案 A（适度精修 — 聚焦态 + 发送按钮态 + 内边距）

- 聚焦态：保持 `focus:ring-2 focus:ring-primary/20`，增加 `focus:shadow-sm` 让焦点更立体，过渡 `transition-shadow`
- 发送按钮：禁用态 `opacity-50` 已有，可用时保持 primary 填充；发送图标 hover 可选微缩放
- 内边距：保持 `px-3 py-2`，与 chat-user 气泡视觉对齐
- 拖放态：保留现有 `bg-primary/5 + 虚线边框` 反馈
- 仅做精修，不大改输入区结构

## Requirements

R1. 消除 floating 模式的双标题栏冗余，统一 header 结构（按 D1 方案 A）
R2. 改善拖拽/缩放交互可见性（显式手柄、视觉反馈）
R3. 重新校准默认尺寸与最小尺寸，提升可用面积
R4. 视觉精致度提升：阴影层级、聚焦态、空状态、输入框、消息间距
R5. 保持 sidebar 模式视觉一致与功能不变（D1 不影响 sidebar header 行为）
R6. 保持非 modal 约束（无 backdrop）、颜色 scheme 兼容、dark mode 兼容、i18n 兼容

## Acceptance Criteria

可通过手动视觉检查验证（无自动化测试覆盖 UI 精致度）：

- **AC1（Header 合并）**：floating 模式下只剩一个 header（History + 标题 + Pin + Close），不再有上层「AI 对话」文字拖拽栏；sidebar 模式 header 视觉与功能完全不变。
- **AC2（拖拽手柄）**：floating 模式 hover header 标题区出现 `cursor-grab`，按下变 `cursor-grabbing`，可拖动面板；点击 header 内 History/Pin/Close 按钮不触发拖拽；sidebar 模式 header 无拖拽行为。
- **AC3（缩放手柄反馈）**：floating 模式鼠标移入面板边缘 6px 出现对应边/角高亮（`bg-primary/30`），拖拽缩放中高亮加深（`bg-primary/50`），cursor 随边/角方向变化（`ns/ew/nwse/nesw-resize`）；离开边缘高亮消失。
- **AC4（尺寸校准）**：清除 localStorage `feedlyra-reader` 后首次打开 floating 面板默认尺寸 420×560；缩放到最小为 320×420；已持久化尺寸的用户不受影响（保持原值）。
- **AC5（阴影与圆角）**：floating 面板圆角 `rounded-xl`；面板内任意输入框聚焦时（或点击内部）阴影提升至 `shadow-2xl` 且 `ring-1 ring-primary/10`，移出且无焦点时回落 `shadow-xl`，过渡平滑。
- **AC6（消息列表）**：消息列表间距为 `space-y-4 px-4 py-4`；空状态保持图标+标题+2×2 建议结构。
- **AC7（入场动画修复）**：首次加载历史消息或切换对话时，已挂载的消息**不再重复播放入场动画**；只有会话中「新追加」的消息（用户发送或 AI 回复生成）应用 `animate-in fade-in slide-in-from-bottom-2`。
- **AC8（输入框）**：textarea 聚焦时出现 `ring + shadow-sm` 立体感；发送按钮禁用态 `opacity-50`、可用态 primary 填充；拖放图片仍显示虚线边框反馈。
- **AC9（兼容性）**：indigo/amber/forest 三种 color scheme 下 `bg-primary` 系列手柄高亮、`--chat-bubble-user` 气泡、`ring-primary/10` 聚焦环均正确跟随主题色；light/dark 模式下阴影、边框、高亮均可见且无对比度问题。
- **AC10（无回归）**：sidebar 模式打开/关闭/切换对话、PinOff↔Pin 切换 sidebar↔floating 模式、关闭重开 floating 面板，均无控制台报错、无 layout 崩溃（参照 spec「Runtime layout-key race」无新增触发）。

## Out of Scope

- 后端 / SSE 流式逻辑变更
- sidebar 模式的布局结构改动（`react-resizable-panels` Group）
- 新增功能（如最大化、吸附边缘、多窗口、键盘拖拽 a11y）

## Open Questions

全部解决（D1–D7）。无 blocking 问题。
