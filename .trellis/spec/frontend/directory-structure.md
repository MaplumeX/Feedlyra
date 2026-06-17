# Directory Structure

> How frontend code is organized in this project.

---

## Overview

React 19 + TypeScript frontend built with Vite. Uses shadcn/ui component library with Tailwind CSS. Feature-based organization with co-located API hooks.

---

## Directory Layout

```
frontend/
├── index.html                 # Vite HTML entry point
├── package.json
├── vite.config.ts             # Vite build config
├── tsconfig.json              # TypeScript config (strict mode)
├── eslint.config.js           # ESLint flat config
├── tailwind.config.ts         # Tailwind CSS config
├── postcss.config.js
├── components.json            # shadcn/ui CLI config
└── src/
    ├── main.tsx               # React DOM entry
    ├── App.tsx                # Root component (providers + routes)
    ├── index.css              # Tailwind directives + CSS variables (light/dark + .theme-*)
    ├── api/
    │   ├── client.ts          # Generic fetch wrapper (api object)
    │   ├── hooks.ts           # TanStack Query hooks + query key factory
    │   ├── sse.ts             # Server-Sent Events stream reader
    │   └── types.ts           # API response interfaces
    ├── components/
    │   ├── Sidebar.tsx        # Feed list sidebar
    │   ├── ArticleList.tsx    # Virtualized article list with grouping
    │   ├── ArticleDetail.tsx  # Article reader with TOC
    │   ├── ArticleTableOfContents.tsx  # Draggable in-reader TOC
    │   ├── AIChatPanel.tsx    # AI chat sidebar/floating panel
    │   ├── FloatingChatPanel.tsx       # Detached-overlay wrapper for floating chat mode
    │   ├── ConversationSidebar.tsx     # Conversation list Popover + row (rename/delete)
    │   ├── AddFeedDialog.tsx
    │   ├── RuleEditorDialog.tsx        # Automation rule create/edit dialog
    │   ├── FeedIcon.tsx       # Favicon with onerror fallback
    │   ├── FeedSortMenu.tsx
    │   ├── FeedSettingsDialog.tsx
    │   ├── CommandPalette.tsx
    │   ├── MarkdownContent.tsx # Shared markdown → sanitized HTML renderer
    │   ├── ProtectedRoute.tsx  # Auth guard
    │   ├── ReadingSettingsPopover.tsx
    │   ├── ThemeProvider.tsx
    │   ├── ThemeToggle.tsx
    │   ├── settings/
    │   │   ├── SettingsDialog.tsx
    │   │   ├── GeneralSettingsTab.tsx
    │   │   ├── AISettingsTab.tsx
    │   │   ├── AutomationTab.tsx        # Automation rule list (scope groups + toggle/delete)
    │   │   ├── EditEmailDialog.tsx
    │   │   ├── EditPasswordDialog.tsx
    │   │   ├── EditUsernameDialog.tsx
    │   │   └── SubscriptionsTab.tsx
    │   └── ui/                # shadcn/ui primitives (auto-generated)
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── dialog.tsx
    │       └── ...
    ├── hooks/
    │   ├── useKeyboardShortcuts.ts
    │   └── useColorScheme.ts   # Reads/applies .theme-* from localStorage
    ├── i18n/
    │   ├── index.ts           # i18next init + zod i18n setup
    │   └── locales/
    │       ├── en/            # { common, auth, reader, settings }.json
    │       └── zh-CN/         # { common, auth, reader, settings }.json
    ├── lib/
    │   ├── utils.ts           # cn() utility (clsx + tailwind-merge)
    │   ├── feedSort.ts        # Feed sort preference types + defaults
    │   ├── languages.ts       # Language option list (UI labels stay literal)
    │   ├── colorScheme.ts     # ColorScheme presets + storage key (indigo/amber/forest)
    │   ├── articleList.ts     # Infinite-list helpers: transitions + first-page replace
    │   ├── i18n-zod.ts        # Zod error map with i18n integration
    │   └── articleList.test.ts # Vitest unit tests for articleList helpers
    ├── pages/
    │   ├── Home.tsx           # Main reader page (3-panel layout + floating chat)
    │   └── auth/
    │       ├── LoginPage.tsx
    │       └── RegisterPage.tsx
    └── stores/
        ├── auth.ts            # Zustand auth store (persisted)
        └── reader.ts          # Zustand reader UI store (partially persisted)
```

---

## Module Organization

- **`src/api/`** — All API interaction co-located: client, hooks, types, SSE streaming
- **`src/components/`** — Feature components at top level; `ui/` for shadcn/ui primitives; feature subfolders (e.g., `settings/`) for grouped components
- **`src/pages/`** — Route-level page components, with subfolders for grouped pages (e.g., `auth/`)
- **`src/stores/`** — Zustand global stores (one file per domain)
- **`src/hooks/`** — Custom React hooks (non-API)
- **`src/lib/`** — Shared utilities
- **`src/i18n/`** — i18n configuration + locale JSON files

---

## Naming Conventions

- **Files**: PascalCase for components (`ArticleList.tsx`), camelCase for utilities (`useKeyboardShortcuts.ts`)
- **Components**: PascalCase named exports (`export function Sidebar()`)
- **Hooks**: camelCase with `use` prefix (`useFeeds`, `useKeyboardShortcuts`)
- **Stores**: camelCase matching domain (`auth.ts`, `reader.ts`)
- **Path alias**: `@/*` maps to `./src/*`

---

## Examples

- Feature component: `src/components/Sidebar.tsx`
- Grouped feature components: `src/components/settings/SettingsDialog.tsx`
- API data flow: `src/api/types.ts` → `src/api/hooks.ts` → component usage
- Page with store integration: `src/pages/Home.tsx` uses `useReaderStore`
