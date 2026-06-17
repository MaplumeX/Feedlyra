# i18n support for RSS automation feature

## Goal

The RSS automation feature (commit 762af22) shipped all user-facing strings as
hardcoded English, marked with `// TODO: i18n`. Wire these strings into the
existing `react-i18next` setup so the feature respects the user's language
(zh-CN / en), consistent with the rest of the app.

## Background

- The app already has i18n (`frontend/src/i18n/`), namespaces: `common`,
  `auth`, `reader`, `settings`. Locale files under `locales/{en,zh-CN}/`.
- Automation strings live in `settings` namespace conceptually, since the tab
  is part of the Settings dialog and `AutomationTab` already renders inside
  `SettingsDialog` (which uses `useTranslation("settings")`).
- Hardcoded strings span 5 files, ~50 occurrences.

## Scope

Files to migrate (all under `frontend/src/`):

1. `components/RuleEditorDialog.tsx` — field/operator/action labels, dialog
   title/description, Scope/Conditions/Actions sections, placeholders, save
   button, conflict warning, validation messages.
2. `components/settings/AutomationTab.tsx` — scope/action labels, group
   headings (Global/Category/Feed), empty state, delete confirm, `conditionSummary`.
3. `components/FeedSettingsDialog.tsx` — "Automation Rules", "Manage".
4. `components/Sidebar.tsx` — `title="Automation"` on the Zap button (line ~556).
5. `components/settings/SettingsDialog.tsx` — `<TabsTrigger>Automation</TabsTrigger>` (line ~47).

## Requirements

- Add `automation.*` keys to BOTH `locales/en/settings.json` and
  `locales/zh-CN/settings.json`. Keep keys in sync between locales.
- Replace every `// TODO: i18n` hardcoded string in the 5 files with `t(...)` calls.
- Use `useTranslation("settings")` in components already in settings context
  (`SettingsDialog`, `AutomationTab`, `RuleEditorDialog`). For components under
  a different default namespace (`Sidebar.tsx`, `FeedSettingsDialog.tsx`, which
  use `reader`), call `t("automation.xxx", { ns: "settings" })`.
- Preserve interpolation where needed (e.g. delete confirm with rule name,
  empty-state counts). Use `{{name}}` i18next interpolation.
- `conditionSummary` must remain a pure English-free string only if it is data;
  but it produces a human-readable condition line, so it must be i18n'd
  (field / operator / logic words / truncation ellipsis).
- Do not change component behavior, styling, or structure — only strings.
- Remove the `// TODO: i18n` comments as each is resolved.

## Non-Goals

- No new namespaces. No backend changes. No re-architecture of i18n config.
- Do NOT touch the unrelated pre-existing strings outside the automation feature.

## Acceptance Criteria

- [ ] `grep -rn "TODO: i18n" frontend/src/components/{RuleEditorDialog.tsx,settings/AutomationTab.tsx,FeedSettingsDialog.tsx,Sidebar.tsx,settings/SettingsDialog.tsx}` returns no matches.
- [ ] `en/settings.json` and `zh-CN/settings.json` both contain the same set of
      `automation.*` keys (no missing keys in either locale).
- [ ] App builds (`npm run build` / type-check) without errors.
- [ ] Switching language to zh-CN shows Chinese for all automation UI; en shows
      English. Verified manually in: Settings → Automation tab, Rule editor
      dialog, Feed settings dialog automation row, Sidebar Zap button tooltip,
      Settings tab label.
- [ ] No behavior regression: create/edit/delete rules, toggle, scope/category
      feed selection, condition add/remove still functional.

## Notes

- `LANGUAGES` labels are proper nouns (language names) — leave as-is, do not i18n.
- `LOGIC_OPTIONS` renders `opt.toUpperCase()` (AND/OR) — these are universal,
  keep as-is.
- Field keys (`title`/`author`/`url`/`content`) reference article fields; the
  *displayed* label should be i18n'd, the *value* (stored data) must not change.
