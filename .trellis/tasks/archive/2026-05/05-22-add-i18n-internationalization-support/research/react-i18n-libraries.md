# Research: React i18n Libraries for React 19 + Vite 6 (2025-2026)

- **Query**: Best i18n libraries for React 19 + Vite 6 projects; evaluate react-i18next, react-intl, lingui, rosetta
- **Scope**: External (library ecosystem research) + Internal (project context)
- **Date**: 2026-05-22

## Findings

### 1. react-i18next (i18next ecosystem)

**Current Version**: react-i18next 17.0.8 / i18next 26.2.0

| Attribute | Detail |
|---|---|
| React 19 Support | Yes. Peer dep `react >= 16.8.0`. Changelog confirms React 19 ref handling fixes (v17.0.2+). Actively maintained with frequent releases. |
| Vite 6 Compatibility | Yes. No known issues. JSON imports work natively with Vite. |
| TypeScript | Ships with `index.d.mts` types. First-class TS support. i18next TypeScript config allows typed translation keys. |
| Bundle Size | react-i18next: ~9.4 KB gzip. i18next: ~13.5 KB gzip. Total: ~23 KB gzip. Additional plugins add more. |
| Weekly Downloads | react-i18next: 12.9M. i18next: 18.0M. (Dominant market position) |
| GitHub Stars | ~9,989 (react-i18next) |
| Lazy Loading | Yes, via `i18next-http-backend` (fetches JSON on demand) or `i18next-resources-to-backend` (dynamic imports). Namespace-based code splitting supported. |
| Pluralization | Full plural support (cardinal/ordinal) via i18next. ICU format available via `i18next-icu` plugin (v2.4.3). |
| Interpolation | `{{ variable }}` syntax. Supports formatting, context, defaults. |
| Language Detection | `i18next-browser-languagedetector` (v8.2.1) supports: navigator language, cookie, localStorage, sessionStorage, URL path/query. Configurable order and caching. |
| Maintenance | Extremely active. Released 2026-05-14. Multiple releases per month. 0 open issues. |
| Learning Curve | Low to medium. Simple `useTranslation()` hook + `<Trans>` component. i18next config can be complex for advanced features. |

**Key Packages**:
- `react-i18next` (v17.0.8) - React bindings
- `i18next` (v26.2.0) - Core framework
- `i18next-http-backend` (v4.0.0) - Lazy loading backend
- `i18next-browser-languagedetector` (v8.2.1) - Language detection
- `i18next-icu` (v2.4.3) - ICU message format
- `i18next-resources-to-backend` - Dynamic import backend for Vite
- `zod-i18n-map` (v2.27.0) - Zod error message localization

---

### 2. react-intl (FormatJS)

**Current Version**: 10.1.9

| Attribute | Detail |
|---|---|
| React 19 Support | Yes. Peer deps: `react: 19`, `@types/react: 19`. Explicitly targeting React 19. |
| Vite 6 Compatibility | Yes. No known issues. |
| TypeScript | Ships with `index.d.ts`. Good TS support but message typing is weaker than react-i18next. |
| Bundle Size | Significantly larger. `@formatjs/intl` + `intl-messageformat` + ICU parser. Estimated total: 30-40 KB gzip. |
| Weekly Downloads | 3.3M (react-intl alone) |
| GitHub Stars | ~14,710 (FormatJS monorepo) |
| Lazy Loading | Limited. Translation messages are typically bundled. Can split by locale with dynamic imports but less ergonomic than i18next. |
| Pluralization | Full ICU plural support (cardinal/ordinal/select). Industry-standard ICU MessageFormat. |
| Interpolation | ICU MessageFormat: `{variable}`, `{variable, number, percent}`, `{count, plural, one{...} other{...}}`. More expressive but more verbose. |
| Language Detection | Manual implementation needed. No built-in detector. Must integrate with browser APIs or routing. |
| Maintenance | Active. Released 2026-05-22. Frequent releases. 5 open issues. |
| Learning Curve | Medium to high. ICU MessageFormat has learning curve. `defineMessages()` API is verbose. |

**Key Packages**:
- `react-intl` (v10.1.9) - React components + hooks
- `@formatjs/intl` (v4.1.12) - Core Intl utilities
- `intl-messageformat` (v11.2.7) - Message parser/formatter

**Notable**: No direct Zod integration exists for react-intl.

---

### 3. Lingui (@lingui/react)

**Current Version**: 6.1.0

| Attribute | Detail |
|---|---|
| React 19 Support | Yes. Peer dep: `react: ^16.14.0 \|\| ^17 \|\| ^18 \|\| ^19`. Explicit React 19 support. |
| Vite 6 Compatibility | Yes, with dedicated `@lingui/vite-plugin` (v6.1.0). Peer dep: `vite: ^6.3.0 \|\| ^7 \|\| ^8`. |
| TypeScript | Ships types. Macro-based approach provides compile-time safety. `@lingui/macro` generates type-safe message IDs. |
| Bundle Size | Runtime: ~5-8 KB gzip (smaller than i18next+react-i18next). Compile-time macro extraction removes message definitions from bundle. |
| Weekly Downloads | 764K (@lingui/react) |
| GitHub Stars | ~5,761 |
| Lazy Loading | Supported via dynamic catalog loading. Lingui's compiled message catalogs can be loaded on demand. |
| Pluralization | Full ICU MessageFormat support. `@lingui/macro` uses ICU plural syntax. |
| Interpolation | ICU MessageFormat via macros: `{name}`, `{count, plural, one{...} other{...}}`. |
| Language Detection | Manual implementation. No built-in browser detector. |
| Maintenance | Active. Released 2026-05-21. Recently shipped v6 stable (2026-04-22). 66 open issues. |
| Learning Curve | Medium. Macro system requires Babel setup. `@lingui/cli` for extraction workflow. Compile-time approach is conceptually different from runtime i18n. |

**Key Packages**:
- `@lingui/react` (v6.1.0) - React bindings
- `@lingui/core` (v6.1.0) - Core runtime
- `@lingui/macro` (v5.9.5) - Compile-time macro extraction
- `@lingui/cli` (v6.1.0) - CLI for message extraction/compilation
- `@lingui/vite-plugin` (v6.1.0) - Vite integration
- `@lingui/conf` (v6.1.0) - Configuration

**Notable**: Requires Babel for macro processing (`@lingui/babel-plugin-lingui-macro`). The Vite plugin depends on `@babel/core` as a peer dep. This adds build complexity to a Vite + esbuild/swc project.

**Notable**: No direct Zod integration exists for Lingui.

---

### 4. Rosetta

**Current Version**: 1.1.0 (last published 2020-06-29)

| Attribute | Detail |
|---|---|
| React 19 Support | No. No React-specific bindings. Last update 6 years ago. |
| Vite 6 Compatibility | Theoretically works (no build tool coupling), but unmaintained. |
| TypeScript | No types. No TS support. |
| Bundle Size | ~298 bytes (as advertised). Extremely small. |
| Weekly Downloads | 43K |
| Lazy Loading | Manual only. |
| Pluralization | Minimal. No built-in plural rules. |
| Interpolation | Simple `{{key}}` replacement via `templite`. |
| Language Detection | None. |
| Maintenance | Abandoned. No updates since 2020. |

**Verdict**: Not viable for a production project in 2025-2026.

---

### 5. Other Alternatives

#### typesafe-i18n

| Attribute | Detail |
|---|---|
| Current Version | 5.27.1 (last published 2026-02-11) |
| Weekly Downloads | 65K |
| Approach | Code-generation based. Generates fully type-safe translation functions from your locale files. |
| React Support | Adapter package `typesafe-i18n-react` available. |
| Bundle Size | Very small runtime (~1 KB). |
| Pluralization | Basic. |
| Vite | Works with Vite but no dedicated plugin. |
| Zod | No integration. |
| Caveats | Development appears to have slowed. Less community momentum. Code-gen step adds workflow complexity. |

#### @lit/localize

Lit-specific (Web Components). Not suitable for React projects.

---

### Translation File Structure Best Practices

#### Flat vs Nested JSON

| Approach | Pros | Cons |
|---|---|---|
| **Flat JSON** (`{ "auth.login.title": "Login" }`) | Simple lookup. No nesting ambiguity. Easy to search. Works well with ICU. | Keys are long. Visual noise. |
| **Nested JSON** (`{ "auth": { "login": { "title": "Login" } } }`) | Organized by feature. Natural hierarchy. | Key collisions in some tools. Deep nesting is hard to maintain. i18next supports both. |
| **Namespace-based** (`auth.json`, `common.json`) | Best code splitting. Load only needed namespaces. Clear ownership. | More files to manage. |

**Recommendation for this project**: Namespace-based + flat keys within each namespace. Example:
```
locales/
  en/
    common.json      # shared: buttons, labels, errors
    auth.json        # login, register
    feed.json        # feed-related
    settings.json    # settings pages
  zh/
    common.json
    auth.json
    ...
```

This aligns with i18next's namespace system and enables lazy loading per route/feature.

---

### Language Detection Strategies for SPAs

| Strategy | Implementation | Pros | Cons |
|---|---|---|---|
| **Browser Language** | `navigator.language` | Automatic. No user action needed. | May not match user preference. |
| **Stored Preference** | localStorage / cookie | Persists across sessions. User choice respected. | First visit still needs fallback. |
| **URL Path** | `/en/login`, `/zh/login` | SEO-friendly. Shareable URLs. | Requires routing changes. More complex. |
| **URL Query** | `?lang=zh` | Simple. No routing changes. | Not persistent. Ugly URLs. |
| **Accept-Language Header** | Server-side detection | Matches HTTP standard. | SPA may not have server rendering. |

**Best practice**: Layered detection with fallback chain:
1. URL parameter (for sharing/SEO, optional)
2. Stored preference (localStorage/cookie)
3. Browser language (`navigator.language`)
4. Default fallback (`en`)

`i18next-browser-languagedetector` supports all of these out of the box with configurable order.

---

### Zod + i18n Integration

**Current project usage**: Zod schemas with hardcoded English error messages in:
- `frontend/src/pages/auth/LoginPage.tsx:12-14` - `loginSchema` with `"Invalid email"`, `"Password must be at least 8 characters"`
- `frontend/src/pages/auth/RegisterPage.tsx:14-17` - `registerSchema` with English messages
- `frontend/src/pages/AISettings.tsx:14-17` - `aiConfigSchema` with English messages

**Integration options**:

| Approach | Library | How It Works |
|---|---|---|
| **zod-i18n-map** (recommended) | `zod-i18n-map@2.27.0` | Provides an i18n error map for Zod. Peer deps: `i18next >= 21.3.0`, `zod >= 3.17.0`. Replaces Zod's default `errorMap` with one that looks up i18next translations. Ships with translation files for 20+ languages. |
| **Custom errorMap** | Manual | Write a custom Zod `errorMap` function that calls your i18n library's `t()` function. More control but more code to maintain. Works with any i18n library. |
| **Per-schema messages** | None | Keep hardcoded strings but make them translation keys: `z.string().email("errors.invalidEmail")`. Simple but loses Zod's built-in message structure. |

**zod-i18n-map workflow**:
1. Install `zod-i18n-map`
2. Import and call `zodI18nMap` with your i18next instance
3. Set `z.setErrorMap(zodI18nMap)` globally
4. Use imported locale files or add custom translations for Zod error keys

This is the cleanest integration when using react-i18next/i18next.

---

### Project Context

Current project stack (from `frontend/package.json`):
- React 19.0.0
- Vite 6.2.0
- TypeScript ~5.7.0
- Zod 3.24.0
- react-hook-form 7.55.0 + @hookform/resolvers 5.0.0
- react-router 7.5.0
- zustand 5.0.0

The project has 3 files with Zod schemas containing hardcoded English strings that need i18n:
- `frontend/src/pages/auth/LoginPage.tsx`
- `frontend/src/pages/auth/RegisterPage.tsx`
- `frontend/src/pages/AISettings.tsx`

---

## Recommendation

**Primary recommendation: react-i18next + i18next**

Rationale:

1. **React 19 support**: Fully compatible. Active fixes for React 19 ref handling (v17.0.2+).
2. **Vite 6 compatibility**: Works without issues. JSON imports are native to Vite. `i18next-resources-to-backend` enables dynamic imports for code splitting.
3. **Zod integration**: `zod-i18n-map` (v2.27.0) provides a direct, well-maintained bridge between Zod and i18next. The project already uses Zod + react-hook-form, and this integration requires minimal changes.
4. **Language detection**: `i18next-browser-languagedetector` handles all detection strategies out of the box.
5. **Market position**: 12.9M weekly downloads. Largest ecosystem. Most tutorials, Stack Overflow answers, and third-party integrations.
6. **Bundle size**: ~23 KB gzip total (react-i18next + i18next). Acceptable for the feature set. Can be reduced further with lazy loading of translation files.
7. **Lazy loading**: Best-in-class namespace system + backend plugins. Natural fit for route-based code splitting.
8. **TypeScript**: Typed translation keys via i18next config. Good DX.

**Why not the others**:

- **react-intl**: Larger bundle, no Zod integration, more verbose API, no built-in language detection. ICU format advantage is offset by i18next's ICU plugin availability.
- **Lingui**: Smaller runtime but requires Babel in the build pipeline (contradicts Vite's esbuild/swc approach). No Zod integration. Smaller community (66 open issues vs 0 for react-i18next). Compile-time macro approach adds conceptual complexity.
- **Rosetta**: Abandoned. Not viable.
- **typesafe-i18n**: Slowing development. No Zod integration. Code-gen workflow adds friction.

**Recommended package set**:
```
dependencies:
  i18next
  react-i18next
  i18next-browser-languagedetector
  i18next-resources-to-backend   (for Vite dynamic imports)
  zod-i18n-map

devDependencies:
  i18next-scanner                 (optional: auto-extract translation keys)
```

## Caveats / Not Found

- react-i18next's React 19 support is via broad peer dep range (>= 16.8.0) rather than an explicit React 19 test suite. However, the changelog shows React 19-specific fixes.
- Bundle size for react-intl could not be confirmed via Bundlephobia API (service issues). Estimated from dependency analysis.
- Lingui's Vite plugin requires `@babel/core` as a peer dependency, which adds Babel to a Vite project. The peer dep also accepts `@rolldown/plugin-babel` as an alternative.
- No direct Zod integration exists for react-intl or Lingui. Custom errorMap implementation would be needed.
- zod-i18n-map is the only mature Zod + i18n integration. It is specifically built for i18next.
