# Implement — 前端全局 UI polish 全维度收口

## Execution Plan

4 有序 phase，每个 phase 末尾跑 `trellis-check` 子代理验证。所有改动限定 `frontend/src/**` + `frontend/tailwind.config.ts` + `DESIGN.md`。

---

## Phase 1 — Token 基建

**目标**：建立 `--warning` token 与 Tailwind 映射，收口 `--chat-bubble-ai` 注释，更新 DESIGN.md 语义层。后续 phase 依赖此 token。

### 步骤

1. `frontend/src/index.css` `:root` 加 `--warning: 38 92% 50%;`（紧邻 `--destructive`），`.dark` 加 `--warning: 45 95% 60%;`。
2. `--chat-bubble-ai` 两处定义（`:root` + `.dark`）上方加注释：
   ```css
   /* Reserved for future floating AI surfaces. Assistant renders as plain
      markdown (no bubble). DO NOT apply as background. See DESIGN.md §5. */
   --chat-bubble-ai: ...;
   ```
3. `frontend/tailwind.config.ts` `theme.extend.colors` 加：
   ```ts
   warning: { DEFAULT: "hsl(var(--warning))" },
   ```
   紧邻 `destructive` 块之后。
4. `DESIGN.md`：
   - 「### Semantic (layer-specific)」补一条 `**Warning**` 项（`#f59e0b` light / 浅琥珀 dark），说明「仅用于非破坏性冲突/警示，不含删除；与 Three Hues 互斥，不随主题切换」。
   - 「## 2. Colors」末尾「### Named Rules」补 **The Warning Rule**：warning 是独立 semantic 色，不参与 One Accent / Three Hues，仅用于非破坏性警示。
   - `--chat-bubble-ai` 引用处补「勿作背景，保留供未来浮层」标注。

### 验证

- `cd frontend && npm run build` 通过（Tailwind 不报 warning 类未定义）。
- `grep -n "warning" frontend/tailwind.config.ts` 命中。
- `grep -n "warning" DESIGN.md` 命中。
- **check**：跑 `trellis-check`，确认 token 语法 + Tailwind config 类型正确。

---

## Phase 2 — 色彩纪律 + auth 渐变

**目标**：消除两处 amber 硬编码；auth 页渐变→accent、logo 圆角→md。

### 步骤

1. `components/settings/AutomationTab.tsx:152` `text-amber-600 dark:text-amber-400` → `text-warning`。保留 `AlertTriangle` icon 与 `t("automation.conflictHint")` 文案。
2. `components/RuleEditorDialog.tsx:359` 整块 `border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300` → `border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning`。保留 `AlertTriangle` 与 `conflictWarning` 文案。
3. `pages/auth/LoginPage.tsx:46` 与 `RegisterPage.tsx:58`：`bg-gradient-to-br from-background via-background to-primary/5` → `bg-accent`。
4. `pages/auth/LoginPage.tsx:49` 与 `RegisterPage.tsx:61`：logo 容器 `rounded-xl` → `rounded-md`。

### 验证

- `grep -rn "amber-" frontend/src --include="*.tsx"` 无命中（AC1）。
- `grep -rn "gradient" frontend/src --include="*.tsx"` 无命中（AC3）。
- 视觉：三主题（indigo/amber/forest）× 双模式下 `text-warning` 不与 primary 撞色（amber 主题下 warning 是独立 semantic 琥珀，primary 是 amber 主色 — 需确认两者色相差异足够，见 R-W1）。
- 若 `text-warning` 对比度 < 4.5:1（R-W1），提深 `--warning` light 至 `38 90% 42%` 重测，直至达标。
- **check**：跑 `trellis-check`。

---

## Phase 3 — 圆角/阴影收口 + ArticleDetail 工具栏一致性

**目标**：圆角与阴影对齐 DESIGN.md resting ceiling；工具栏表面状态一致性。

### 步骤

1. `components/AIChatPanel.tsx:257` 与 `:304` 用户气泡 `rounded-2xl` → `rounded-lg`（DESIGN.md `chat-bubble-user: {lg}`）。
2. `components/FloatingChatPanel.tsx:339`：
   - `rounded-xl` → `rounded-lg`
   - `shadow-xl` → `shadow-lg`
   - 移除 `focus-within:shadow-2xl`，保留 `focus-within:ring-1 focus-within:ring-primary/10`
3. 跨表面圆角扫尾（R12）：grep `rounded-xl|rounded-2xl|rounded-3xl`，凡非浮层（dialog/popover/command 的 `sm:rounded-lg` 与 ui/* shadcn 保留）一律 `rounded-xl` → `rounded-md`（resting）或 `rounded-lg`（浮层语义）。已知待查：`AIChatPanel.tsx:264,505` input `rounded-xl` → `rounded-md`（input 是 resting，DESIGN.md input `rounded: {md}`）；`ArticleTableOfContents.tsx:271,296` 浮层 `rounded-md` 保留。
4. `components/ArticleDetail.tsx` 工具栏（R11）：逐个 icon Button 核查 `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` 一致；icon `h-4 w-4` 一致；`title`/`aria-label` 无遗漏（当前已较完整，补缺即可，结构不动）。

### 验证

- `grep -rn "rounded-2xl\|rounded-3xl" frontend/src --include="*.tsx"` 无命中（AC2）。
- `grep -rn "rounded-xl" frontend/src --include="*.tsx"` 仅剩浮层（需人工核验列表）。
- `node .pi/skills/impeccable/scripts/detect.mjs --json frontend/src` 命中数下降（AC8）。
- ArticleDetail 工具栏三主题 × 双模式视觉：hover/focus-visible/active 反馈一致。
- **check**：跑 `trellis-check`。

---

## Phase 4 — 功能性收口 + i18n

**目标**：RuleEditorDialog 冲突阻止保存；ConversationSidebar 相对时间 i18n。

### 步骤

1. `frontend/src/i18n/locales/zh/reader.json` + `en/reader.json` 新增 4 key（见 design.md contract 表）：`relativeNow`、`relativeMinutes`（带 `{{count}}`）、`relativeHours`、`relativeDays`。
2. `components/ConversationSidebar.tsx` `formatRelativeTime`（行 217）改用 `t()`：
   ```ts
   function formatRelativeTime(iso: string, t: TFunction): string {
     const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
     if (diffMin < 1) return t("relativeNow");
     if (diffMin < 60) return t("relativeMinutes", { count: diffMin });
     const diffHr = Math.floor(diffMin / 60);
     if (diffHr < 24) return t("relativeHours", { count: diffHr });
     const diffDay = Math.floor(diffHr / 24);
     if (diffDay < 7) return t("relativeDays", { count: diffDay });
     return new Date(iso).toLocaleDateString();
   }
   ```
   调用处（行 124）传入 `t`。
3. `i18n/locales/*/reader.json` 新增 `automation.conflictBlockingHint` key（zh：「删除与其他动作不可同时启用，请取消其中一项」/ en：「Delete cannot combine with other actions. Uncheck one.」）。
4. `components/RuleEditorDialog.tsx`：
   - Save 按钮 `disabled` 加入 `hasConflict`：
     ```tsx
     disabled={isPending || !name.trim() || noActionsSelected || hasConflict}
     ```
   - `hasConflict` 时在 Save 上方显示 helper text `text-xs text-warning`（复用 R3 已收敛的 warning tint 视觉，或简化为纯 `text-warning`）+ `<AlertTriangle className="h-3 w-3" />`。

### 验证

- `cd frontend && npm run lint` 通过（新 i18n key 无未定义）。
- `cd frontend && npm run build` 通过（AC9）。
- 交互测试：RuleEditorDialog 同时勾选 delete + mark_read → Save 禁用 + helper text；取消其一 → Save 启用（AC4）。
- 中英环境切换：ConversationSidebar 时间显示本地化（AC5）。
- **check**：跑 `trellis-check`（final pass，全 scope）。

---

## Validation Commands 汇总

```bash
cd frontend && npm run lint
cd frontend && npm run build
grep -rn "amber-" frontend/src --include="*.tsx"          # 期望无命中
grep -rn "rounded-2xl\|rounded-3xl" frontend/src --include="*.tsx"  # 期望无命中
grep -rn "gradient" frontend/src --include="*.tsx"        # 期望无命中
node ../.pi/skills/impeccable/scripts/detect.mjs --json frontend/src
```

## Rollback Points

每个 phase 一个 commit。最危险是 Phase 1（token 未见效会让 Phase 2 的 `text-warning` 类无声退化为无样式）— Phase 1 build 验证 warning 类生成后再进 Phase 2。
