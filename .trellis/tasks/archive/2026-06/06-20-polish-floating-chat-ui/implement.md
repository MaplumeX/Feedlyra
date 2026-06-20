# Implement — Polish Floating Chat UI

## Ordered Implementation Checklist

按依赖顺序，每步可独立验证。先做 store 常量 → 浮窗容器骨架 → header 注入 → 面板内视觉 → 共享 AIChatPanel 微调。

### Step 1 — 校准默认尺寸（store）
- [ ] `frontend/src/stores/reader.ts`：`DEFAULT_FLOATING_SIZE` 改为 `{ width: 420, height: 560 }`
- [ ] （可选）记录在 spec：floating min 尺寸常量已迁到 FloatingChatPanel 内，需同步更新 `MIN_WIDTH=320`、`MIN_HEIGHT=420`
- **验证**：清 localStorage 后首次打开 floating，尺寸 420×560；缩到最小 320×420

### Step 2 — FloatingChatPanel 容器重构（去双 header 注入拖拽 + D5 阴影 + D3 缩放高亮）
- [ ] 删除自渲染的 `h-10` 拖拽标题栏（`<div className="flex h-10 ...">{t("chatPanel")}</div>` 整块）
- [ ] 移除不再需要的 `useTranslation`（若 `t("chatPanel")` 是唯一用法）
- [ ] 容器 className 调整：`rounded-lg` → `rounded-xl`，加 `transition-shadow focus-within:shadow-2xl focus-within:ring-1 focus-within:ring-primary/10`（保留基础 `shadow-xl border bg-background`）
- [ ] 更新 `MIN_WIDTH=320`、`MIN_HEIGHT=420`
- [ ] 新增 `ResizeEdgeOverlay` 子组件：根据 `hoveredEdge` 渲染 4 边（`h-px/w-px` 全长）+ 4 角（`h-1.5 w-1.5`）overlay，`pointer-events-none absolute bg-primary`，非 active 时 `opacity-30`、resize 中 `opacity-50`。放在容器内、children 之前
- [ ] 新增 `dragProps` 对象，通过 `React.cloneElement(children, { draggable: true, ...dragProps })` 注入到 AIChatPanel
- [ ] 引入 `import React from "react"`（或用现有 React import，确认类型）
- **验证**：floating 模式无上层拖拽栏；鼠标移边缘出现高亮 + cursor；聚焦输入框阴影变深；sidebar 模式不受影响（Home.tsx sidebar 分支不经过 FloatingChatPanel）

### Step 3 — AIChatPanel header 接受拖拽（D1 + D2）
- [ ] `AIChatPanelProps` 新增：`draggable?: boolean`、`onHeaderPointerDown?`、`onHeaderPointerMove?`、`onHeaderPointerUp?`（类型复用 FloatingChatPanel 的 handler 签名）
- [ ] header `<div>` className 用 `cn()` 条件加：`draggable && "cursor-grab active:cursor-grabbing select-none"`
- [ ] header `<div>` 的 `onPointerDown/Move/Up` 在 `draggable` 时分别绑定注入的 handler（否则 undefined）
- [ ] History `PopoverTrigger`（内层 Button）、Pin `Button`、Close `Button` 各加 `onPointerDown={(e) => e.stopPropagation()}`
- [ ] sidebar 分支不传 `draggable`，header 行为保持原样
- **验证**：floating 下拖 header 可移动面板；点 History/Pin/Close 不触发拖拽；sidebar 下 header 不显示 grab cursor、无拖拽

### Step 4 — Home.tsx 调用点确认
- [ ] 确认 `<FloatingChatPanel><AIChatPanel conversationId={...} /></FloatingChatPanel>` 无需改 JSX 结构（cloneElement 在 FloatingChatPanel 内部完成注入）
- [ ] 确认 sidebar 分支 `<AIChatPanel conversationId={...} />` 无 `draggable` 传入
- **验证**：两种模式编译通过、渲染正确

### Step 5 — 消息列表精致度 + 动画修复（D6）
- [ ] 消息列表容器：`space-y-5 px-3 py-3` → `space-y-4 px-4 py-4`
- [ ] 新增 `renderedIdsRef = useRef<Set<string>>(new Set())` 和 `newIds` state
- [ ] 同步 chatHistory 的 effect：重置 `renderedIdsRef.current` 为当前所有消息 id 集合，`setNewIds(new Set())`（历史不动画）
- [ ] `conversationId` 变化的 effect（重置 messages）：同步清空 `renderedIdsRef.current` 和 `setNewIds(new Set())`
- [ ] `handleSend` 追加 `temp-` userMsg 后：`setNewIds(prev => new Set(prev).add(userMsg.id))`
- [ ] `doStream` 追加 `temp-assistant-` msg 后：`setNewIds(prev => new Set(prev).add(assistantMsg.id))`
- [ ] `handleRegenerate` / `handleEdit` 重新 `doStream` 时：新 assistant 的 id 已在 doStream 内入 newIds，无需额外处理
- [ ] `.map` 渲染：外层 div className 用 `cn("duration-300", newIds.has(msg.id) && "animate-in fade-in slide-in-from-bottom-2")`
- **验证**：首次加载历史消息无入场动画级联；发送新消息/生成回复有淡入上滑；切换对话回来仍无重复动画

### Step 6 — 输入框聚焦态（D7）
- [ ] ChatInput textarea className：加 `transition-shadow` 与 `focus:shadow-sm`（保留现有 `focus:ring-2 focus:ring-primary/20 focus:border-primary`）
- **验证**：textarea 聚焦时有轻微 shadow 立体感，失焦回落平滑

### Step 7 — icon/空状态微调（D6 收尾）
- [ ] `ChatEmptyState` icon 容器视情况微调（保持现状亦可，确认不与同色系冲突）
- [ ] 建议按钮 `-translate-y-0.5` hover 微动效保留
- **验证**：空状态视觉协调

## Validation Commands

```bash
# 类型 + 构建
cd frontend && npm run build

# lint（若有）
cd frontend && npm run lint

# dev 预览（手动验证 AC1–AC10）
cd frontend && npm run dev
```

无单元测试覆盖 UI 精致度，验收依赖 PRD 的 AC1–AC10 手动 checklist。

## Risky Files & Rollback Points

| 文件 | 风险点 | 回滚策略 |
|---|---|---|
| `FloatingChatPanel.tsx` | cloneElement 类型 cast、拖拽 handler 注入后 pointer 事件链路 | 若注入出问题，临时恢复 h-10 拖拽栏，D2/D3/D5 仍保留 |
| `AIChatPanel.tsx` | 动画 newIds Set 与流式 onChunk、conversation 切换的交互 | 若动画状态错乱，先回退 D6 动画部分（恢复无条件 animate-in），D1–D5 不受影响 |
| `stores/reader.ts` | DEFAULT_FLOATING_SIZE 改动只影响新用户，无回归风险 | 单行回退 |

## Pre-Start Checks

- [ ] 确认 `frontend/src/pages/Home.tsx` 的 FloatingChatPanel 调用点未变（D1 在 FloatingChatPanel 内部 cloneElement，Home.tsx 不需改）
- [ ] 确认 `types/react` 中 `cloneElement` 在当前 React 版本可用（项目用 React 18+，可用）
- [ ] 跑一次 `npm run build` 确认基础无错（改动前 baseline）

## Follow-up Checks（实现后）

- [ ] window resize clamp 逻辑在新默认尺寸下仍工作（420×560 在小屏可能超出 → clamp 应正常）
- [ ] dark mode 下边缘高亮 `bg-primary/30`、聚焦环 `ring-primary/10` 可见性
- [ ] 三套 color scheme（indigo/amber/forest）切换后高亮/气泡/聚焦环色彩跟随
- [ ] sidebar↔floating 切换、关闭重开无控制台报错（layout-key race 无新增触发）
