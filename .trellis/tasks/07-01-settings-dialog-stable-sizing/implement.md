# Implement: Settings Dialog Split-Pane Layout

## 执行清单（有序）

1. **读 spec 前置**（trellis-before-dev）：`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`、`.trellis/spec/frontend/index.md`。
2. **改 `frontend/src/components/settings/SettingsDialog.tsx`**：
   - `DialogContent` className：移除 `transition-[max-width] duration-150`、移除 `max-h-[calc(100vh-4rem)] overflow-y-auto`、移除按 `activeTab` 切 `max-w-*` 的三元；改为 `sm:max-w-3xl max-h-[calc(100vh-4rem)]`（整体上限保留防顶出视口，但内层内容区承载滚动）。
   - `Tabs` container：包一层 `flex flex-col sm:flex-row gap-2 sm:gap-4`。
   - **桌面 TabsList**：`className="hidden sm:flex flex-col w-40 gap-1 h-auto justify-start"`，传 `orientation="vertical"`；`TabsTrigger` 加 `className="justify-start"`。
   - **移动 TabsList**：`className="flex w-full sm:hidden"`；`TabsTrigger` 加 `className="flex-1"`。
   - **内容区容器**：`<div className="mt-4 sm:mt-0 sm:ml-6 sm:flex-1 sm:min-w-0 sm:max-h-[60vh] sm:overflow-y-auto">`，里面放 5 个 `TabsContent`（className 从 `mt-4` 调整为不重复外层间距，例如保留 `mt-0` 或去掉）。
   - 移除未用 import（若有）。
3. **不动各 tab 内部**：`SubscriptionsTab`/`AutomationTab` 的内层滚动保持原样（见 design.md 内层滚动调和）。
4. **lint + type-check**：`cd frontend && pnpm lint && pnpm type-check`，绿。
5. **手动目测**（实现方自测，记录到检查结果）：5 个 tab 切换时外框宽度/高度不变；Subscriptions/Automation 列表可滚；About 居中；缩到 `< 640px` 回退顶部 Tabs。

## 验证命令

```bash
cd frontend
pnpm lint
pnpm type-check
```

## 风险点 / 回滚

- 单文件改动，回滚 `git checkout frontend/src/components/settings/SettingsDialog.tsx`。
- 重点验证：双 `TabsList` 渲染下 Radix active 同步、纵向 list 键盘箭头方向。

## Follow-up（实现后再确认是否需要 spec 更新）

- 若确立了「Settings 类 dialog 用分栏 + 固定 max-h 内滚」模式，考虑在 `.trellis/spec/frontend/component-guidelines.md` 增补一条 dialog 尺寸稳定约定（由 trellis-update-spec 决定）。
