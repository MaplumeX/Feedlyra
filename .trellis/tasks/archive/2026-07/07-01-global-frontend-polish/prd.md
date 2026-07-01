# 前端全局 UI polish 全维度收口

## Goal

对 Feedlyra 前端做一次全局 polish pass，沿 impeccable `polish` 全维度清单收口 DESIGN.md「The Reading Room」体系残留 drift，使 chrome 与设计系统在色彩/圆角/阴影/交互状态/IA/文案/i18n 全维度对齐。

## Background

- 项目已是 product register，PRODUCT.md / DESIGN.md / `frontend/src/index.css`（HSL token + 三色主题）齐备。
- 最近一次 critique（2026-06-29，`Home.tsx`，34/40 Good）留下 1 P1 + 2 P2 backlog，是本次 pass 的核心种子。
- impeccable detector + grep 已扫描 `frontend/src`，确认下列 drift 点。

## 已确认事实（证据：detector + grep，2026-07-01）

### 色彩纪律（One Accent / Three Hues 违规）
- `components/settings/AutomationTab.tsx:152` — 冲突提示 `text-amber-600 dark:text-amber-400`（critique P1）。amber 在 Indigo/Amber/Forest 互斥体系里无位置；用户当前主题为 Amber 时撞色。
- `components/RuleEditorDialog.tsx:359` — 同类 amber tint 块 `border-amber-300 bg-amber-50 ... text-amber-700`（detector 未覆盖，grep 新发现）。同一违规家族第二处。

### 圆角纪律（DESIGN.md rounded: sm2/md6/lg6/pill；resting ceiling）
- `components/AIChatPanel.tsx:257,304` — 用户气泡 `rounded-2xl`（16px），DESIGN.md `chat-bubble-user: rounded: {lg}`（6px）。（critique Minor）
- `components/FloatingChatPanel.tsx:339` — `rounded-xl shadow-xl focus-within:shadow-2xl`，休息面过重（DESIGN.md resting ceiling = shadow-sm；浮层可 shadow-lg，但 2xl 偏重）。
- `pages/auth/LoginPage.tsx:49`、`RegisterPage.tsx:61` — logo 容器 `rounded-xl`（auth 属 product chrome，应为 md=6px）。

### 渐变禁令（DESIGN.md「Don't use gradients — gradient backgrounds」）
- `pages/auth/LoginPage.tsx:46`、`RegisterPage.tsx:58` — `bg-gradient-to-br from-background via-background to-primary/5`。虽极淡，仍属 DESIGN.md 明令禁止。

### ArticleDetail 工具栏密度（critique P2，结构性 — 本轮结构冻结）
- `components/ArticleDetail.tsx` — 单 h-11 工具条挤 Star/Read/Summarize/Translate/Chat/Extract + Settings + ExternalLink = 8 动作，pure icon 依赖记忆。用户决定**结构冻结**：不做「AI 三件套收 dropdown」的重排，本轮只做表面一致性 polish（icon size/title/状态反馈一致性）。

### 错误预防（critique P2，功能性）
- `components/RuleEditorDialog.tsx` — `hasConflict`（含 delete 的 multi-action）仅 warning 不阻止保存；`noActionsSelected` 已有 disabled 先例。本轮加入 `hasConflict` 时禁用 Save。

### i18n 残留（critique P3）
- `components/ConversationSidebar.tsx:217` `formatRelativeTime` 返回 `"now"/"3m"/"2h"/"1d"` 硬编码英文，中文环境泄漏。

### Token 卫生
- `--chat-bubble-ai` token（`index.css` `:root` + `.dark`）保留「for future use」但刻意不应用。需加注释防误用。

### detector 命中（已分类为合法/false-positive，不计入 backlog）
- `index.css:235` blockquote `border-left: 3px` — DESIGN.md 唯一命名例外。
- `index.css:255` `chat-bounce` — DESIGN.md 显式定义的 typing dots；保留现状（见 D5）。
- `index.css:191,222,228` radius 3px/2px — `calc(radius ± 2px)`，属设计系统衍生，advisory 可忽略。
- `stores/reader.ts:16` fontFamily `"system"` — 系 FONT_OPTIONS 合法用户可选项（见 `ReadingSettingsPopover.tsx`），非 drift。

## Decisions

- **D1（任务结构）**: 单任务 + 分阶段 `implement.md`。drift 家族共享 DESIGN.md 对齐根因，parent/child 拆分会切碎同一份设计系统评审、planning 成本翻倍。多数为 token/类名级小修，真正需独立讨论的仅 ArticleDetail 工具栏（本轮结构冻结）与错误预防（功能性）。`implement.md` 分 4 有序 phase，末尾各跑 check。
- **D2（amber 警示色收口）**: 新增 `--warning` semantic token（`:root` `38 92% 50%` / `.dark` `45 95% 60%`），写入 DESIGN.md「Colors」semantic 层。与 Three Hues 互斥、不随主题切换、仅用于非破坏性冲突/警示（不含删除）。两处 amber → `text-warning` / `border-warning/30 bg-warning/5 text-warning`。
- **D3（错误预防）**: `RuleEditorDialog` `hasConflict` 时禁用 Save（沿用 `noActionsSelected` 机制），加 helper text 说明「删除与其它动作不可同时启用」。纯前端，不改后端语义。
- **D4（auth 渐变）**: `LoginPage`/`RegisterPage` `bg-gradient-to-br ...` → `bg-accent`。给页面一档微妙 surface 区分，无渐变、无主色滥用。
- **D5（chat-bounce 保留）**: DESIGN.md 已显式点名「staggered bounce」作为 typing indicator 状态反馈动效，属命名例外，保留现状不改。
- **D6（`--chat-bubble-ai` token）**: 保留 + 加 CSS 注释（assistant 渲染为纯 markdown 无 bubble，此 token 保留供未来浮层使用，勿作背景）；同步 DESIGN.md 原文加标注。
- **D7（ArticleDetail 工具栏）**: 结构冻结。本轮只做表面一致性（icon size、title/aria-label 一致、focus-visible:ring 统一、active 态反馈），不拆不收。
- **D8（polish 维度纳入）**: 纳入 A（交互状态完整性）+ C（跨表面圆角一致性 `rounded-xl`/`rounded-2xl` → `rounded-md`/`rounded-lg`）。排除 B（移动端触摸目标 44px，单列 adapt 轮）+ D（transition-colors 微调，非 drift）。

## Requirements

- R1 新增 `--warning` token（`index.css` `:root` + `.dark`），DESIGN.md 补 Warning semantic 项与规则。
- R2 `AutomationTab.tsx:152` amber → `text-warning`。
- R3 `RuleEditorDialog.tsx:359` amber tint block → `border-warning/30 bg-warning/5 text-warning`。
- R4 `RuleEditorDialog` Save 按钮 `disabled` 加入 `hasConflict`；下方加 helper text（i18n key）。
- R5 `AIChatPanel.tsx:257,304` 用户气泡 `rounded-2xl` → `rounded-lg`。
- R6 `FloatingChatPanel.tsx:339` `rounded-xl` → `rounded-lg`；`shadow-xl` → `shadow-lg`；移除 `focus-within:shadow-2xl`（休息面降重）。
- R7 `LoginPage.tsx:49`、`RegisterPage.tsx:61` logo 容器 `rounded-xl` → `rounded-md`。
- R8 `LoginPage.tsx:46`、`RegisterPage.tsx:58` `bg-gradient-to-br ...` → `bg-accent`。
- R9 `ConversationSidebar.tsx` `formatRelativeTime` 返回值改用 `t()` + i18n keys（`relativeNow`/`relativeMinutes`/`relativeHours`/`relativeDays`），reader 或 common ns。
- R10 `--chat-bubble-ai` token 两处定义加注释；DESIGN.md 原文补「勿作背景」标注。
- R11 ArticleDetail 工具栏表面一致性：核查所有 icon 按钮 `focus-visible:ring-2 ring-ring ring-offset-2` 统一；icon size `h-4 w-4` 一致；title/aria-label 无遗漏。
- R12 跨表面圆角一致性：grep `rounded-xl`/`rounded-2xl`/`rounded-3xl`，凡非浮层（dialog/popover/command 的 `sm:rounded-lg` 保留）一律收至 `rounded-md`/`rounded-lg`。
- R13 交互状态完整性：所有 `Button`/`Switch`/可点击行覆盖 default/hover/focus-visible/active/disabled；重点核查 ArticleDetail 工具栏与 ConversationSidebar 行与 ArticleList 同构。
- R14 三主题（indigo/amber/forest）× 双模式（light/dark）下 warning token 与所有改动视觉验证无撞色、对比度 ≥4.5:1。

## Acceptance Criteria

- [ ] AC1 `grep -rn "amber-" frontend/src --include="*.tsx"` 无命中（ripe token 替代）。
- [ ] AC2 `grep -rn "rounded-2xl\|rounded-3xl" frontend/src --include="*.tsx"` 无命中（除 DESIGN.md 命名例外）；`rounded-xl` 仅留在浮层组件。
- [ ] AC3 `grep -rn "gradient" frontend/src --include="*.tsx"` 无命中。
- [ ] AC4 `RuleEditorDialog` 在 `hasConflict` 时 Save 禁用 + helper text 显示；`noActionsSelected` 行为不变。
- [ ] AC5 `ConversationSidebar.formatRelativeTime` 中文环境返回中文（`刚刚`/`3分钟前`/`2小时前`/`1天前`），英文环境返回英文。
- [ ] AC6 `--chat-bubble-ai` token 保留，两处定义旁有注释。
- [ ] AC7 ArticleDetail 工具栏所有 icon 按钮 `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` 一致。
- [ ] AC8 `node .pi/skills/impeccable/scripts/detect.mjs --json frontend/src` 命中数 ≤ 当前（6 → 目标 ≤ 3，仅剩命名例外/advisory）。
- [ ] AC9 `cd frontend && npm run lint && npm run build` 通过。
- [ ] AC10 DESIGN.md「Colors」含 Warning semantic 项；「Don'ts」或 token 表标注 `--chat-bubble-ai` 勿作背景。
- [ ] AC11 三主题 × 双模式视觉验证：warning 色与主色互斥无撞色；amber 主题下 warning（独立 semantic）不与 amber primary 撞色。

## Out of Scope

- ArticleDetail 工具栏结构重排（AI 三件套收 dropdown）— 本轮结构冻结，仅表面一致性。
- 移动端触摸目标 44×44px 适配 — 单列 `adapt` 轮。
- `transition-colors` 时长微调与全局动效优化 — 非 drift。
- 后端规则引擎「delete 优先执行顺序」语义 — 纯前端 error prevention，不改后端。
- `--chat-bubble-ai` token 删除与 DESIGN.md「assistant 永远无 bubble」硬规则升级 — 保留策略（D6）。
