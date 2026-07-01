# 设置页添加关于 Tab 显示版本号

## Goal

在设置对话框（SettingsDialog）中新增「关于」Tab，展示应用版本号、项目名、简介、仓库链接，让用户能在前端查看当前版本与项目信息。

## Confirmed Facts (来自代码库)

- `frontend/package.json` 当前版本为 `1.0.3`；无根 `package.json`。
- `frontend/vite.config.ts` 目前没有 `define` 配置，版本号需通过构建时注入（如 `__APP_VERSION__`）。
- `frontend/src/components/settings/SettingsDialog.tsx` 现有 4 个 Tab：general / ai / subscriptions / automation，使用 Radix `Tabs`。
- i18n 设置文案在 `frontend/src/i18n/locales/{zh-CN,en}/settings.json`。
- 顶部 Tab 按钮使用 `flex-1` 平均分配宽度，宽度会随 Tab 数变化。
- `DialogContent` 宽度按 `activeTab` 切换 `sm:max-w-*`（general/ai 走 `sm:max-w-[480px]`，subscriptions 走 `sm:max-w-2xl`，automation 走 `sm:max-w-xl`）。
- 仓库链接：`https://github.com/MaplumeX/Feedlyra`（来自 `git remote`）。
- 项目简介来源：
  - 英文（README.md）："A self-hosted RSS feed reader with integrated AI capabilities — summarize, translate, and chat with your articles using any OpenAI-compatible LLM."
  - 中文（README.zh-CN.md）："一个自带 AI 能力的自托管 RSS 阅读器 —— 使用任意 OpenAI 兼容的大语言模型来摘要、翻译和对话你的文章。"

## Requirements

1. 新增 `AboutTab` 组件，作为 SettingsDialog 的第 5 个 Tab（`about`）。
2. 版本号通过 Vite `define` 注入 `__APP_VERSION__`（来源于 `frontend/package.json` 的 `version` 字段），不硬编码字符串。
3. `AboutTab` 显示内容（方案 A）：
   - 项目名称：Feedlyra
   - 一句话简介（i18n：中英文来自 README）
   - 版本号：`v{__APP_VERSION__}`
   - 仓库链接：`https://github.com/MaplumeX/Feedlyra`（可点击，新窗口打开）
4. 中英文 i18n 文案齐全（`settings.json` 新增 `about` 相关键）。
5. Tab 布局：5 个 Tab 在现有宽度下排布合理，不破版。
6. `DialogContent` 宽度：`about` Tab 走与 `general`/`ai` 一致的 `sm:max-w-[480px]`。

## Acceptance Criteria

- [ ] 设置对话框中出现「关于」Tab（第 5 个）。
- [ ] 关于 Tab 显示版本号 `v1.0.3`（来自 `package.json`，构建时注入，不硬编码）。
- [ ] 关于 Tab 显示项目名、简介、仓库链接（可点击新窗口打开）。
- [ ] 中英文 i18n 文案齐全。
- [ ] 5 个 Tab 在 `sm:max-w-[480px]` 宽度下排布合理，不破版、不溢出。
- [ ] `tsc -b` 与 `eslint` 通过，无新增 warning。

## Notes

- 版本号来源用 Vite `define` 注入 `__APP_VERSION__`，需在 `vite.config.ts` 中 `import pkg from './package.json' with { type: 'json' }`（或 `readFileSync`）读取。
- `__APP_VERSION__` 需要在 `vite-env.d.ts` / 全局类型声明中声明类型，避免 TS 报错。
- 仓库链接硬编码为常量即可（非 i18n 内容）。
