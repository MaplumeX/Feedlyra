# Design — 前端全局 UI polish 全维度收口

## Scope

纯前端（`frontend/src/**`）+ 两份设计系统文档（`DESIGN.md`、`frontend/src/index.css`）。无后端、无 API 契约、无 DB migration。

## Architecture & Boundaries

不引入新组件、不新增文件。改动集中在：

1. **Token 层**（`frontend/src/index.css`）：新增 `--warning`，注释 `--chat-bubble-ai`。
2. **组件层**（~7 文件）：类名替换 + `RuleEditorDialog` Save disabled 逻辑 + `ConversationSidebar` i18n + `ArticleDetail` 工具栏状态一致性。
3. **文档层**（`DESIGN.md`）：补 Warning semantic 项 + token 标注。

## Contracts

### `--warning` token 契约

```
:root  --warning: 38 92% 50%;        /* 琥珀，与 destructive 同属 semantic layer */
.dark   --warning: 45 95% 60%;        /* dark 略提亮保对比 */
```

- 不进 `.theme-indigo/.theme-amber/.theme-forest` override 列表 — 与 Three Hues 互斥、不随主题切换。
- 用途限定：非破坏性冲突/警示文案与 tint 块（不含删除确认，删除仍走 `destructive`）。
- contrast：`text-warning` 在 `background`/`card` 上需 ≥ 4.5:1（light 38 92% 50% on 220 20% 98% 预估 ≈ 2.3:1 ❌ — 见 Risk R-W1，实际需提深至 `38 90% 40%` 左右达标）。

### `RuleEditorDialog` Save 状态机

```
disabled = isPending || !name.trim() || noActionsSelected || hasConflict
```

- `hasConflict = hasDelete && otherActionsCount > 0`（已存在，复用）。
- helper text（`hasConflict` 时显示）：复用现有 `conflictWarning` 文案位置，新增 `automation.conflictBlockingHint` key（「删除与其它动作不可同时启用，请取消其中一项」）。

### `formatRelativeTime` i18n

新增 4 key（reader ns）：

| key | zh | en |
|---|---|---|
| `relativeNow` | 刚刚 | now |
| `relativeMinutes` | {{count}}分钟前 | {{count}}m |
| `relativeHours` | {{count}}小时前 | {{count}}h |
| `relativeDays` | {{count}}天前 | {{count}}d |

> 7 天以上 fallback 仍走 `toLocaleDateString()`（已 i18n 感知，不改）。

### 圆角收口规则

| 原值 | 新值 | 作用域 |
|---|---|---|
| `rounded-2xl` | `rounded-lg` | 用户气泡（DESIGN.md `chat-bubble-user: {lg}`） |
| `rounded-xl`（resting） | `rounded-md` | auth logo、FloatingChatPanel 容器 |
| `rounded-xl`（floating layer） | `rounded-lg` | ArticleTableOfContents、AIChatPanel input（浮层语义） |
| `sm:rounded-lg`（dialog/popover/command） | 保留 | ui/* shadcn 组件，DESIGN.md floating layer |

### 阴影收口

- `FloatingChatPanel.tsx:339` `shadow-xl` → `shadow-lg`；移除 `focus-within:shadow-2xl`，保留 `focus-within:ring-1 focus-within:ring-primary/10` 作 focus 反馈。
- shadcn `ui/*` 的 `shadow-md`/`shadow-lg` 保留（floating layer 合规）。

## Data Flow

无数据流变更。`RuleEditorDialog` 的 `hasConflict` 是纯前端派生 state，不影响提交 payload（仍交后端校验）。

## Compatibility & Migration

- `--warning` token 新增不破坏现有：未应用前任何 `text-warning` 类不解析（Tailwind 需 config 映射 — 见 R-T1）。
- i18n key 新增需同步 `frontend/src/i18n/locales/*/reader.json`（zh + en），缺失 key 退化为 raw key 文本。
- `formatRelativeTime` 返回值变更影响 `ConversationSidebar` 与 `ConversationRow` 两处调用（同文件内）。

## Risks

- **R-W1（warning 对比度）**: 琥珀色在浅色背景上对比度天然不足。需在 implement 时实测 `text-warning` vs `background`，不达标则提深色相（向 `38 90% 40%` 或 `32 85% 42%` 调）直至 ≥ 4.5:1。dark 模式同理验证。
- **R-T1（Tailwind token 映射）**【已查清】: 项目用 Tailwind v3 + `tailwind.config.ts`。`--warning` 需在 config `theme.extend.colors` 加 `warning: { DEFAULT: "hsl(var(--warning))" }`（照 `destructive` 同样式），类才会生成。无风险。
- **R-IA（ArticleDetail 工具栏）**: 结构冻结下，仅做状态一致性可能不足以降 critique P2 分（密度问题本质是结构）。accept：本轮不追求 P2 清零，只做表面 polish；P2 结构项留待未来 adapt/distill 轮。

## Rollback

每 phase 独立小 commit，单 phase 回滚不影响他 phase。Phase 1 验证 warning 类生成后再进入 Phase 2。
