# Research: i18n Integration Patterns for React

- **Query**: Practical integration patterns for i18n in React apps (Zod, shadcn/ui, Zustand, Vite, language switcher, date/number formatting)
- **Scope**: Mixed (internal codebase analysis + external library research)
- **Date**: 2026-05-22

## Findings

---

### 1. Zod Validation Messages i18n

#### Approach: zod-i18n-map (Recommended Library)

**Package**: `zod-i18n-map` (v2.27.0, MIT, 46 versions, actively maintained)
**GitHub**: https://github.com/aiji42/zod-i18n
**Dependency**: Requires `i18next` as peer dependency (shares the same i18next instance as the rest of the app)

**How it works**:
- Provides a custom Zod error map (`zodI18nMap`) that intercepts Zod error generation and translates messages via i18next
- Ships pre-built locale files for 30 languages under `zod-i18n-map/locales/{lang}/zod.json`
- Supported locales include: ar, bg, cs, de, en, es, fa, fi, fr, he, hr-HR, id, is, it, ja, ko, lt, nb, nl, pl, pt, ro, ru, sk, sv, tr, uk-UA, uz, zh-CN, zh-TW

**Core setup pattern**:

```ts
// src/lib/i18n-zod.ts
import i18next from "i18next";
import { z } from "zod";
import { zodI18nMap } from "zod-i18n-map";
import translationEn from "zod-i18n-map/locales/en/zod.json";
import translationZhCN from "zod-i18n-map/locales/zh-CN/zod.json";

i18next.init({
  lng: "en",
  resources: {
    en: { zod: translationEn },
    "zh-CN": { zod: translationZhCN },
  },
});

z.setErrorMap(zodI18nMap);
export { z };
```

**Integration with react-hook-form + zodResolver**: No special handling needed. The `zodResolver` from `@hookform/resolvers/zod` calls Zod's `safeParse`, which uses the globally set error map. Once `z.setErrorMap(zodI18nMap)` is called, all Zod validation messages (including those through react-hook-form) will automatically be translated.

**Key**: Import `z` from the configured module (`@/lib/i18n-zod`) instead of from `zod` directly, so the error map is always applied.

**Custom refine/transform error translation** (e.g., the "Passwords do not match" pattern in RegisterPage.tsx):

```ts
// Using i18n params in refine:
z.string().refine(() => false, {
  params: { i18n: "passwordsDoNotMatch" },  // key in i18next namespace
})

// Or with values:
z.string().refine(() => false, {
  params: { i18n: { key: "customError", values: { field: "password" } } },
})
```

**Namespace support**: `makeZodI18nMap({ ns: ["zod", "custom"] })` allows mixing built-in Zod translations with app-specific validation messages.

**Path-aware error messages**: `zod-i18n-map` supports `handlePath` option for `z.object` schemas, producing messages like "Email is expected string, received number" instead of just "Expected string, received number". Uses `_with_path` suffixed keys.

#### Current Project Zod Usage (Hardcoded Messages to Migrate)

| File | Line | Hardcoded Message |
|---|---|---|
| `frontend/src/pages/auth/LoginPage.tsx` | 13 | `"Invalid email"` |
| `frontend/src/pages/auth/LoginPage.tsx` | 14 | `"Password must be at least 8 characters"` |
| `frontend/src/pages/auth/RegisterPage.tsx` | 14 | `"Invalid email"` |
| `frontend/src/pages/auth/RegisterPage.tsx` | 15 | `"Username must be at least 3 characters"`, `"Only letters, numbers, and underscores"` |
| `frontend/src/pages/auth/RegisterPage.tsx` | 16 | `"Password must be at least 8 characters"` |
| `frontend/src/pages/auth/RegisterPage.tsx` | 20 | `"Passwords do not match"` |
| `frontend/src/pages/AISettings.tsx` | 15 | `"Invalid URL"` |
| `frontend/src/pages/AISettings.tsx` | 17 | `"Model is required"` |

---

### 2. shadcn/ui Components i18n

#### Hardcoded Strings in UI Primitives

The only hardcoded user-facing string found in shadcn/ui components is in `dialog.tsx`:

```tsx
// frontend/src/components/ui/dialog.tsx line 44
<span className="sr-only">Close</span>
```

This is an accessibility label for screen readers. It must be translated for proper i18n.

#### Radix UI Primitives i18n Considerations

Radix UI primitives (which shadcn/ui wraps) support the `dir` attribute for RTL languages and `lang` attribute on the root element. Key patterns:

- **Dialog**: The `Close` button sr-only text "Close" needs translation. No other Radix Dialog strings are hardcoded.
- **Select**: Radix Select renders no built-in visible text; all labels come from props. The `placeholder` prop must be translated.
- **Command (cmdk)**: The `placeholder` and `CommandEmpty` text are app-supplied and need translation.
- **DropdownMenu**: No built-in text; all labels come from children props.

#### Pattern: Override shadcn/ui Components for i18n

For the dialog.tsx "Close" sr-only text, modify the component to accept a translation:

```tsx
// Option A: Use useTranslation directly in the component
import { useTranslation } from "react-i18next";
// Inside DialogContent:
<span className="sr-only">{t("common.close")}</span>
```

This is the simplest approach. Alternatively, the text can be passed as a prop, but using `useTranslation` inside the component is cleaner for a single string.

#### Component Translation Checklist (App Components, Not UI Primitives)

Hardcoded strings found in app-level components using shadcn/ui:

| File | Strings to Translate |
|---|---|
| `AddFeedDialog.tsx` | "Add Feed", "Add an RSS/Atom feed by URL...", "Feed URL", "Discover", "Find", "Add", "No feeds discovered." |
| `CommandPalette.tsx` | "Search articles, feeds, actions...", "No results found.", "Navigation", "All Feeds", "Unread", "Starred", "Actions", "Mark All as Read", "Refresh Feeds", "Toggle Sidebar", "AI Settings", "AI", "Summarize Current Article", "Translate Current Article", "Open AI Chat" |
| `Sidebar.tsx` | "All Feeds", "Unread", "Starred", "Feeds", "Subscriptions", "No feeds yet. Click + to add one.", "Refresh", "Delete" |
| `ArticleList.tsx` | "Today", "Yesterday", "All", "Unread", "Starred", "Mark All Read", "No articles" |
| `ArticleDetail.tsx` | "AI Summarize", "Show Original", "Show Translation", "AI Translate", "AI Chat", "Translation" |
| `AIChatPanel.tsx` | "Ask about this article..." |
| `LoginPage.tsx` | "Login", "Sign in to your Feedlyra account", "Email", "Password", "Signing in...", "Sign in", "No account?", "Register" |
| `RegisterPage.tsx` | "Register", "Create a new Feedlyra account", "Email", "Username", "Password", "Confirm Password", "Creating account...", "Create account", "Already have an account?", "Login" |
| `AISettings.tsx` | "AI Settings", "BYOK Configuration", "Base URL", "API Key", "Model", "Save", "Test Connection", "Connection failed", "API key is already configured" |

---

### 3. Language Switcher UI Patterns

#### Pattern A: Dropdown in Header/Navbar (Most Common)

A dropdown menu in the app header showing the current language with options to switch. This is the most widely used pattern in SPAs.

```tsx
// Using shadcn/ui DropdownMenu (already in the project)
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";  // Already imported in CommandPalette

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const languages = [
    { code: "en", label: "English" },
    { code: "zh-CN", label: "简体中文" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Pattern B: Settings Page Toggle

A radio group or select in a dedicated Settings page. Better for apps with more language options or where language switching is infrequent.

#### Pattern C: Flag Icons (Avoid)

Flag icons are generally **not recommended** for language switchers because:
- Languages are not countries (e.g., Portuguese in Brazil vs. Portugal)
- Flags can be politically sensitive
- Some languages span multiple countries (English, Arabic, Spanish)
- Accessibility concerns (screen readers cannot read flag images)

**Best practice**: Use the language name written in its own script (e.g., "English", "简体中文", "日本語"). This is self-identifying and unambiguous.

#### Pattern D: Combination

For this project, Pattern A (dropdown with `Languages` icon from lucide-react, which is already imported) placed in the Sidebar header or a top bar is the most natural fit. The `Languages` icon is already used in `CommandPalette.tsx`.

---

### 4. i18n with Zustand

#### Architecture Decision: i18next Manages Language, Zustand Reads It

**Recommended pattern**: Let `i18next-browser-languagedetector` handle language detection and persistence via its built-in localStorage caching (`i18nextLng` key). Use Zustand only if there is a separate UI preference store that needs to know the current language.

**Why not Zustand for language persistence**:
1. `i18next-browser-languagedetector` already persists to localStorage with the key `i18nextLng` by default
2. Duplicating language state in Zustand creates a synchronization problem (two sources of truth)
3. i18next has its own event system for language changes; syncing with Zustand adds complexity for no benefit

**If language preference must be in Zustand** (e.g., for a unified settings store), use a one-way sync:

```ts
// Option: Sync from i18next to Zustand (i18next is source of truth)
import i18next from "i18next";
import { useSettingsStore } from "@/stores/settings";

// In app initialization:
i18next.on("languageChanged", (lng) => {
  useSettingsStore.getState().setLanguage(lng);
});

// When user changes language in settings:
function changeLanguage(lng: string) {
  i18next.changeLanguage(lng);  // This triggers the event above
}
```

**Current Zustand Store Pattern** (from `stores/auth.ts` and `stores/reader.ts`):
Both use `persist` middleware with localStorage. The auth store uses key `feedlyra-auth` and reader uses `feedlyra-reader`. If a settings store is created, it would follow the same pattern with key `feedlyra-settings`.

**i18next-browser-languagedetector configuration**:

```ts
import LanguageDetector from "i18next-browser-languagedetector";

i18next.use(LanguageDetector).init({
  detection: {
    order: ["localStorage", "navigator"],
    caches: ["localStorage"],
    lookupLocalStorage: "i18nextLng",
  },
  supportedLngs: ["en", "zh-CN"],
  fallbackLng: "en",
});
```

This detects language from localStorage first (persisted preference), then browser settings, and caches the choice back to localStorage.

---

### 5. Vite-Specific i18n Setup

#### No Special Vite Plugin Required

The `vite-plugin-i18next` package (v0.1.0, only 1 version, unmaintained) is an editor tool, not a bundling plugin. It is not needed for production i18n setup.

**The standard approach for Vite + i18next** uses `i18next-resources-to-backend` for lazy loading translation files:

```ts
// src/lib/i18n.ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((language, namespace) =>
    import(`../locales/${language}/${namespace}.json`)
  ))
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN"],
    ns: ["common", "auth", "settings", "reader"],  // namespaces by feature
    defaultNS: "common",
    interpolation: {
      escapeValue: false,  // React already escapes
    },
  });
```

**Important Vite note**: The dynamic `import()` with template literal works in Vite because Vite uses native ESM and handles glob imports. The pattern `import('../locales/${language}/${namespace}.json')` is supported by Vite's glob import mechanism.

**Alternative: Static imports for small apps** (fewer locales, small files):

```ts
import enCommon from "../locales/en/common.json";
import zhCommon from "../locales/zh-CN/common.json";

i18next.init({
  resources: {
    en: { common: enCommon },
    "zh-CN": { common: zhCommon },
  },
});
```

This bundles all translations into the main chunk. Simpler setup but no lazy loading.

**Recommended for this project**: Use static imports initially (only 2 locales: en, zh-CN), since the total translation payload will be small (likely under 10KB). Can switch to `i18next-resources-to-backend` if more locales are added later.

**Vite config**: No changes needed in `vite.config.ts` for i18n. The JSON files are imported as ESM modules by default in Vite.

**App initialization pattern** (wrapping in Suspense for lazy loading):

```tsx
// src/main.tsx
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./lib/i18n";  // Initialize i18next before React renders
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <App />
    </Suspense>
  </StrictMode>
);
```

The `Suspense` wrapper is required when using `i18next-resources-to-backend` (lazy loading). With static imports, `Suspense` is optional but harmless.

---

### 6. Date/Number Formatting with i18n

#### Current Project Date Formatting

`ArticleList.tsx` (lines 16-26) already uses `toLocaleDateString` with a basic configuration:

```ts
// Current pattern:
date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
```

The `undefined` first argument uses the browser's default locale. This needs to be changed to use the i18next-detected language.

#### Approach: Use i18next Language for Intl APIs

```ts
import { useTranslation } from "react-i18next";

function formatDate(dateStr: string | null): string {
  const { i18n } = useTranslation();
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return i18n.t("dates.today");    // Translated "Today"
  if (diffDays === 1) return i18n.t("dates.yesterday"); // Translated "Yesterday"

  return date.toLocaleDateString(i18n.language, {
    month: "short",
    day: "numeric",
  });
}
```

**Key change**: Pass `i18n.language` (e.g., `"en"` or `"zh-CN"`) as the first argument to `toLocaleDateString` instead of `undefined`. This ensures formatting matches the user's selected language.

#### Number Formatting Pattern

```ts
function formatNumber(num: number): string {
  return new Intl.NumberFormat(i18n.language).format(num);
}
// e.g., formatNumber(12345) => "12,345" (en) or "12,345" (zh-CN)
```

#### Relative Time Formatting

For "2 hours ago" style labels, use `Intl.RelativeTimeFormat`:

```ts
function formatRelativeTime(dateStr: string): string {
  const { i18n } = useTranslation();
  const diffSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });

  if (diffSeconds < 60) return rtf.format(-Math.floor(diffSeconds), "second");
  if (diffSeconds < 3600) return rtf.format(-Math.floor(diffSeconds / 60), "minute");
  if (diffSeconds < 86400) return rtf.format(-Math.floor(diffSeconds / 3600), "hour");
  return rtf.format(-Math.floor(diffSeconds / 86400), "day");
}
// en: "3 hours ago", zh-CN: "3小时前"
```

#### i18next Formatting Option (Alternative)

i18next also supports a `format` function for interpolation:

```ts
i18next.init({
  interpolation: {
    format: (value, format, lng) => {
      if (value instanceof Date) {
        return new Intl.DateTimeFormat(lng, { dateStyle: "long" }).format(value);
      }
      if (format === "number") {
        return new Intl.NumberFormat(lng).format(value);
      }
      return value;
    },
  },
});

// Usage in translation:
// "lastUpdated": "Last updated: {{date, DateTimeFormat}}"
```

However, for React components, using `Intl` APIs directly with `i18n.language` is simpler and more flexible.

#### Browser Support

`Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.RelativeTimeFormat` are supported in all modern browsers. `Intl.RelativeTimeFormat` requires Chrome 71+, Firefox 65+, Safari 14+, Node.js 12+.

---

## Packages to Install

| Package | Version | Purpose |
|---|---|---|
| `i18next` | ^26.2.0 | Core i18n framework |
| `react-i18next` | ^17.0.8 | React bindings for i18next (supports React >= 16.8, including React 19) |
| `i18next-browser-languagedetector` | ^8.2.1 | Browser language detection + localStorage persistence |
| `zod-i18n-map` | ^2.27.0 | Zod error message translation |
| `i18next-resources-to-backend` | ^1.2.1 | Lazy loading translation JSON (optional, only if more than 2-3 locales) |

**Note**: `vite-plugin-i18next` is NOT recommended (unmaintained, single version, editor-only tool).

---

## Proposed Directory Structure for Translation Files

```
frontend/src/
  locales/
    en/
      common.json      # Shared: "Close", "Save", "Cancel", "Today", "Yesterday"
      auth.json        # Login/Register page strings
      reader.json      # Article list, sidebar, article detail strings
      settings.json    # AI settings page strings
      zod.json         # Override/extend zod-i18n-map defaults (optional)
    zh-CN/
      common.json
      auth.json
      reader.json
      settings.json
      zod.json
  lib/
    i18n.ts            # i18next initialization + zod error map setup
```

---

## Related Specs

- `.trellis/spec/frontend/type-safety.md` — Currently unfilled; Zod validation i18n approach should be documented here
- `.trellis/spec/frontend/state-management.md` — Currently unfilled; i18n language state coordination pattern should be documented here
- `.trellis/spec/frontend/component-guidelines.md` — Should reference i18n patterns for shadcn/ui components

## Caveats / Not Found

- `zod-i18n-map` does NOT document react-hook-form integration explicitly, but it works seamlessly because zodResolver uses Zod's safeParse which respects the global error map.
- No official shadcn/ui i18n guide exists. The only hardcoded string in shadcn/ui primitives is the Dialog "Close" sr-only label.
- `i18next-resources-to-backend` dynamic imports work in Vite but the README only shows webpack examples. Vite handles the glob import natively.
- No `vite-plugin-i18next` production-ready plugin exists. The available one (v0.1.0) is an editor tool only.
- `i18next` v26 is the latest; ensure `react-i18next` v17 is used (peer dependency requires i18next >= 26.2.0).
- For RTL languages (Arabic, Hebrew), additional CSS and Radix `dir` attribute handling would be needed, but this is out of scope for the initial en/zh-CN implementation.
