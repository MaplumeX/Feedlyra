# Type Safety

> Type safety patterns in this project.

---

## Overview

TypeScript in strict mode with additional compiler checks. Zod for runtime validation with i18n integration. Path alias `@/*` for imports.

---

## TypeScript Configuration

From `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## Type Organization

**API response types** — centralized in `src/api/types.ts` using `export interface`:

```tsx
export interface Feed { id: string; title: string; url: string; /* ... */ }
export interface Article { id: string; feed_id: string; /* ... */ }
export interface ArticleListResponse { items: Article[]; total: number; page: number; limit: number; }
```

**Component-local types** — defined inline or as named interfaces in the same file:

```tsx
// Inline for simple cases
function ArticleRow({ article, isSelected }: {
  article: Article;
  isSelected: boolean;
}) { /* ... */ }

// Named interface for complex props
interface AIChatPanelProps {
  articleId: string;
  articleTitle: string;
}
```

**Schema-derived types** — via Zod inference:

```tsx
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginForm = z.infer<typeof loginSchema>;
```

**Discriminated unions** — for list rendering:

```tsx
type FlatItem =
  | { type: "header"; label: string }
  | { type: "article"; article: Article };
```

---

## Validation

Zod with i18n-aware error messages via `zod-i18n-map`:

```tsx
// src/lib/i18n-zod.ts — global Zod error map
makeZodI18nMap({ ns: ["zod", "auth", "common"] })
```

Custom `.refine()` messages use `params: { i18n: "key" }` pattern:

```tsx
.refine((data) => data.password === data.confirmPassword, {
  message: "",  // resolved by i18n map
  params: { i18n: "passwordsDoNotMatch" },
})
```

Forms use react-hook-form + @hookform/resolvers for Zod integration.

---

## Common Patterns

- Use `interface` for API types, `type` for unions and utility types
- Import API types from `@/api/types` — don't redefine them
- Use `z.infer<typeof schema>` instead of manually typing form data
- Use `as const` for query key factory and literal types

---

## Forbidden Patterns

- **`any`** — Never use. Use `unknown` if the type is truly unknown and narrow it.
- **Type assertions (`as X`)** — Avoid unless truly necessary (e.g., mocking). Prefer type guards or proper typing.
- **Non-null assertion (`!`)** — Avoid. Use optional chaining or explicit null checks instead. With `noUncheckedIndexedAccess`, array access returns `T | undefined` — handle the undefined case.
