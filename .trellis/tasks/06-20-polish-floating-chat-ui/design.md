# Design — Polish Floating Chat UI

## Architecture & Boundaries

改动集中在 3 个文件，外加 store 常量微调。不改后端、不改 sidebar 布局结构、不改 i18n 文案（键已齐全）。

| 文件 | 改动性质 | 说明 |
|---|---|---|
| `frontend/src/stores/reader.ts` | 常量调整 | `DEFAULT_FLOATING_SIZE` → `{width:420,height:560}` |
| `frontend/src/components/FloatingChatPanel.tsx` | 结构重构 | 移除自身 `h-10` 拖拽栏；容器只保留定位 + 8 方向缩放 + cursor + 边缘高亮 overlay + 动态阴影；向 `children` 注入拖拽 handlers |
| `frontend/src/components/AIChatPanel.tsx` | 新增 prop + 微调 | 新增 `draggable?` + 拖拽 handler props；header 条件应用 grab cursor；消息间距/padding/动画修复；输入框 focus shadow |
| `frontend/src/pages/Home.tsx` | 调用点适配 | `<FloatingChatPanel>` 上把拖拽 props 透传给 `<AIChatPanel>`（见「Props 注入方式」） |

## D1 落地：header 合并的 Props 注入方式

不把 AIChatPanel 硬耦合到 FloatingChatPanel 内部知识。采用**回调注入 + 透传**模式，FloatingChatPanel 通过 render 上下文 给 AIChatPanel。

### 方案：FloatingChatPanel 通过 `cloneElement` 注入拖拽 props

```tsx
// FloatingChatPanel.tsx
const dragProps = {
  onHeaderPointerDown: handleDragPointerDown,
  onHeaderPointerMove: handleDragPointerMove,
  onHeaderPointerUp: handleDragPointerUp,
};

return createPortal(
  <div ref={containerRef} className="...rounded-xl..." ...resize handlers...>
    {/* 边缘高亮 overlay（见 D3） */}
    <ResizeEdgeOverlay edge={hoveredEdge} active={!!resizeStateRef.current} />
    <div className="flex min-h-0 flex-1">
      {React.cloneElement(children as React.ReactElement, { draggable: true, ...dragProps })}
    </div>
  </div>,
  document.body,
);
```

```tsx
// AIChatPanel.tsx
interface AIChatPanelProps {
  conversationId: string;
  draggable?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

// header div
<div
  className={cn(
    "flex items-center gap-2 border-b px-3 py-2",
    draggable && "cursor-grab active:cursor-grabbing select-none",
  )}
  onPointerDown={draggable ? onHeaderPointerDown : undefined}
  onPointerMove={draggable ? onHeaderPointerMove : undefined}
  onPointerUp={draggable ? onHeaderPointerUp : undefined}
>
  {/* History / Pin / Close 按钮内部加 onPointerDown={e=>e.stopPropagation()} */}
</div>
```

**为什么 `cloneElement` 而非 context**：FloatingChatPanel 永远只包一个孩子（AIChatPanel），props 透传最直接；context 反而引入 Provider 复杂度。cloneElement 的类型安全通过显式 cast + props interface 保证。

**sidebar 模式**：Home.tsx 直接 `<AIChatPanel conversationId={...} />`，不传 `draggable`，header 行为 100% 不变。

### 按钮 stopPropagation 边界

header 内三个功能元素需阻止 pointerdown 冒泡到 header 拖拽：
- `<PopoverTrigger>`（History）—— PopoverTrigger 包了 Button，在 trigger 上加 `onPointerDown={e=>e.stopPropagation()}`
- Pin/Close `<Button>` —— 同上

注意：`stopPropagation` 在 pointerdown 即可，不影响 click 事件冒泡（click 仍正常触发按钮逻辑）。

## D3 落地：缩放边缘高亮 overlay

复用现有 `hoveredEdge: string | null` state（已有），新增轻量子组件 `ResizeEdgeOverlay`：

```tsx
function ResizeEdgeOverlay({ edge, active }: { edge: string | null; active: boolean }) {
  if (!edge) return null;
  const base = "pointer-events-none absolute bg-primary transition-opacity";
  const opacity = active ? "opacity-50" : "opacity-30";
  // 4 边：top/bottom/left/right 用 inset 定位 1px 高亮
  // 4 角：corner 用 6x6 小方块
  return (
    <div className={cn(base, opacity)}>
      {/* 按 edge 渲染对应边/角的 absolute div */}
    </div>
  );
}
```

8 个 edge 映射到 8 组 `absolute` 定位规则（边用 `h-px`/`w-px` 全长，角用 `h-1.5 w-1.5`）。这些 overlay 在容器内 `pointer-events-none`，不干扰缩放 pointerdown 检测（overlay 不阻止事件，缩放仍走容器 `getResizeEdge` 逻辑）。

## D5 落地：动态阴影层级（纯 CSS）

```tsx
// FloatingChatPanel 容器 className
"fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-xl select-none transition-shadow",
"focus-within:shadow-2xl focus-within:ring-1 focus-within:ring-primary/10"
```

- 基础态：`shadow-xl`（失焦时回落到此）
- `:focus-within`：textarea 或任何子元素聚焦时升级 `shadow-2xl + ring`
- 无需 React state，纯 CSS 伪类
- `transition-shadow` 复用全局 150ms（index.css 已对 shadow 设 transition？需确认 —— 全局 transition 只含 color/bg/border/fill/stroke，**不含 shadow/ring**，需手动加 `transition-shadow`）

**失焦降饱和（可选）**：鼠标移出且无焦点时，`opacity-95` 之类。本次实现先做基础 `:focus-within`，失焦降饱和作为 follow-up，避免过度调节。

## D6 落地：入场动画修复

现有代码把 `animate-in` 包在 `messages.map` 外层 div，导致所有历史消息挂载时都动画。用 ref 追踪「已见过的消息 id 集合」：

```tsx
// AIChatPanel.tsx
const renderedIdsRef = useRef<Set<string>>(new Set());
const [newIds, setNewIds] = useState<Set<string>>(new Set()); // 触发渲染

useEffect(() => {
  setMessages(prev => {
    // 从 chatHistory 同步时，所有消息标记为已渲染（不动画）
    const seen = new Set(prev.map(m => m.id));
    renderedIdsRef.current = seen;
    setNewIds(new Set()); // 历史挂载全部不动画
    return chatHistory.messages ?? prev;
  });
}, [chatHistory]);

// handleSend 追加 userMsg 时：
setNewIds(prev => new Set(prev).add(userMsg.id));

// doStream 追加 assistantMsg 时：
setNewIds(prev => new Set(prev).add(assistantMsg.id));
```

渲染：

```tsx
{messages.map((msg) => (
  <div
    key={msg.id}
    className={cn(
      "duration-300",
      newIds.has(msg.id) && "animate-in fade-in slide-in-from-bottom-2",
    )}
  >
    <ChatMessageBubble ... />
  </div>
))}
```

**简化方案**：其实只需追踪「上一轮渲染时的最后一个消息 id」——只有比它更新的消息才动画。但 conversation 切换时 setMessages([]) 重置，需同步重置 newIds。用 Set 更直观且支持「批量新增多动画」场景。

**边界**：`onChunk` 流式更新最后一条 assistant 消息内容（不新增 id），不会重复触发动画（id 已在 newIds 里，但 React diff 只更新文本不重播 CSS 动画 —— CSS 动画只在元素首次挂载时播放，后续 re-render 不重播，安全）。

## D7 落地：输入框

```tsx
// ChatInput textarea
className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm 
  placeholder:text-muted-foreground transition-shadow
  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:shadow-sm
  disabled:cursor-not-allowed disabled:opacity-50"
```

仅加 `transition-shadow` + `focus:shadow-sm`。其余不变。

## Data Flow & Contracts

```
Home.tsx
  ├─ sidebar:  <AIChatPanel conversationId />                    (draggable absent)
  └─ floating: <FloatingChatPanel>{<AIChatPanel conversationId />}</FloatingChatPanel>
                         │
                         └─ cloneElement 注入: draggable + onHeaderPointer{Down,Move,Up}
```

store 改动：`DEFAULT_FLOATING_SIZE` 常量值变化。已有持久化用户用 `partialize` 里存的旧值，不受影响（新默认只对首次使用用户生效）。

## Compatibility & Migration

- **已持久化尺寸用户**：Zustand persist 会把老 `floatingPanelSize: {width:380,height:500}` 读回来，新默认不覆盖已有值。可接受（D4 明确「仅影响未自定义过用户」）。若要强制升级，需加 migrate，但本次不做（避免破坏用户自定义布局）。
- **i18n**：无新增键，全部复用现有 `chatPanel`/`aiChat`/`switchToFloating`/`switchToSidebar`/`closeChat`。
- **color scheme**：所有新视觉用语义 token（`bg-primary`/`ring-primary`/`border`/`bg-background`），三套 preset 自动跟随。无需改 `index.css` 的 `.theme-*` 规则。
- **dark mode**：`shadow-*`/`ring-*` 在 dark 下同样适用；边缘高亮 `bg-primary/30` 在 dark 下 `--primary` 偏亮，透明度 30% 仍可读。
- **layout-key race**：不改 `<Group key={groupKey}>` 逻辑，不触碰 sidebar Panel 渲染条件，无新增触发 spec 警告的路径。
- **ScrollArea `[&>div]:!block`**：不改消息列表的 ScrollArea 结构，沿用现有 wrapper fix。

## Key Trade-offs

- `cloneElement` 方案牺牲了一点类型严格度（children cast），换取无需 context Provider 的简洁注入。对单孩子场景可接受。
- 入场动画用 Set state 会多一次 re-render（每次发消息 setNewIds 触发），但发消息本身已是低频交互，性能可忽略。
- `:focus-within` 阴影无法覆盖「鼠标在面板内但未聚焦输入」场景 —— 若要「hover 即提亮」需加 `hover:shadow-2xl`。本次保持 `:focus-within` 一档，避免桌面端 floating 面板频繁闪动。

## Rollback

改动局部、可增量回退。若 D1 cloneElement 注入有意外问题，可回退到「双 header」临时方案（恢复 FloatingChatPanel 的 h-10 栏），其余 D2–D7 改动独立、互不阻塞。
