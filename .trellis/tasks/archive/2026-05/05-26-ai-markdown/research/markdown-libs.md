# Research: Markdown Rendering Libraries for React

- **Query**: Best markdown rendering libraries for React (2025-2026), React 19 + Tailwind prose + DOMPurify context
- **Scope**: External (library comparison) + Internal (project current state)
- **Date**: 2026-05-26

## Findings

### Project Current State

| File Path | Description |
|---|---|
| `frontend/package.json` | React 19, Vite 6, Tailwind 3, @tailwindcss/typography, dompurify 3.4.5 |
| `frontend/src/components/ArticleDetail.tsx` | Current rendering: DOMPurify.sanitize + dangerouslySetInnerHTML for article content; plain text (`whitespace-pre-wrap`) for AI summary (L252) |
| `frontend/src/components/AIChatPanel.tsx` | Chat messages rendered as plain text (`whitespace-pre-wrap`) (L148) |
| `.trellis/tasks/05-26-ai-markdown/prd.md` | Task PRD: add markdown rendering to AI summary area |

No markdown rendering library is currently installed. The project uses DOMPurify for HTML sanitization and `@tailwindcss/typography` for prose styling.

---

### Library Comparison

#### 1. react-markdown (v10.1.0)

| Metric | Value |
|---|---|
| **npm package size** | 15.5 KB (gzipped tarball) |
| **Install size (node_modules)** | 7.9 MB, 77 packages (includes remark-parse, remark-rehype, unified, hast-util-to-jsx-runtime, etc.) |
| **With remark-gfm** | 9.0 MB, 95 packages |
| **Weekly npm downloads** | ~23.3M |
| **GitHub stars** | 15,724 |
| **Last publish** | 2025-03-07 |
| **Last repo push** | 2025-04-21 |
| **Open issues** | 5 |
| **Peer dependencies** | `react >= 18`, `@types/react >= 18` |
| **Runtime dependencies** | remark-parse, remark-rehype, unified, hast-util-to-jsx-runtime, mdast-util-to-hast, unist-util-visit, vfile, devlop, html-url-attributes, @types/hast, @types/mdast |

**React 19 compatibility**: Officially supported. `peerDependencies` declares `react >= 18`. Issue #920 (React 19 support request) was closed as already fixed in v10. Issue #911 (JSX namespace issue with React 19) was also closed — the fix is in v10.x. Some users reported TypeScript issues with v10.1.0 and React 19 (JSX namespace errors), but the maintainer states these are resolved in the latest version and may be configuration issues.

**SSR/Edge compatibility**: Works with SSR. Uses `unified`/`remark` ecosystem which is ESM-only. Compatible with Vite and edge runtimes. No DOM dependency in the parsing pipeline.

**Security**: Does NOT render raw HTML by default (safe by default). To render raw HTML, you need `rehype-raw` plugin, which can then be paired with `rehype-sanitize` for XSS protection. Alternatively, the project's existing DOMPurify can sanitize the markdown output.

**Tailwind prose integration**: Excellent. react-markdown renders to React elements directly (not HTML string), so you can wrap with `<div className="prose ...">` or apply classes via the `components` prop to customize individual element rendering. No `dangerouslySetInnerHTML` needed.

**Usage pattern with this project**:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-slate max-w-none dark:prose-invert">
  {article.summary}
</ReactMarkdown>
```

**Caveats**:
- Heavy dependency tree (85 packages). Most are from the unified/remark ecosystem.
- ESM-only (no CJS). Works with Vite but may cause issues in some SSR setups.
- v10 removed the `className` prop (breaking change from v9). Styling must be applied via wrapper or `components` prop.
- The `components` prop allows overriding rendering of any element (h1, p, code, a, etc.) for custom styling.

---

#### 2. marked (v18.0.4)

| Metric | Value |
|---|---|
| **npm package size** | 111.9 KB (gzipped tarball) |
| **Install size (node_modules)** | 464 KB, 1 package (zero dependencies) |
| **Weekly npm downloads** | ~44.4M |
| **GitHub stars** | 36,831 |
| **Last publish** | 2026-05-19 |
| **Last repo push** | 2026-05-26 |
| **Open issues** | 10 |
| **Peer dependencies** | None |
| **Runtime dependencies** | None |

**React 19 compatibility**: Not a React library. Outputs HTML strings. Requires `dangerouslySetInnerHTML` or manual DOM insertion in React. No React-specific peer dependency issues.

**SSR/Edge compatibility**: Excellent. Pure JS, no DOM dependency. Works everywhere. Small and fast.

**Security**: marked has had XSS vulnerabilities historically. The `marked` package itself does NOT sanitize HTML. You MUST use `DOMPurify` or a similar sanitizer on the output. The project already has DOMPurify, so this is manageable. marked v5+ has a `sanitize` option but the official recommendation is to use DOMPurify.

**Tailwind prose integration**: Good. Outputs an HTML string which can be injected via `dangerouslySetInnerHTML` into a `<div className="prose ...">` container. Same pattern the project already uses for article content.

**Usage pattern with this project**:
```tsx
import { marked } from 'marked';

const html = marked(article.summary);
const sanitized = DOMPurify.sanitize(html);

<div className="prose prose-slate max-w-none dark:prose-invert"
  dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**Caveats**:
- Requires `dangerouslySetInnerHTML` — loses React's virtual DOM diffing for the markdown content.
- Must pair with DOMPurify for security (already available in project).
- Extensions available (marked-gfm-heading-id, marked-highlight, etc.) for additional features.
- TypeScript types available via `@types/marked` (dev dependency, ~40KB additional).
- Extremely fast parser. Benchmarks consistently show marked as the fastest JS markdown parser.

---

#### 3. markdown-it (v14.2.0)

| Metric | Value |
|---|---|
| **npm package size** | 221.1 KB (gzipped tarball) |
| **Install size (node_modules)** | 1.8 MB, 7 packages |
| **Weekly npm downloads** | ~23.4M |
| **GitHub stars** | 21,480 |
| **Last publish** | 2026-05-23 |
| **Last repo push** | 2026-05-26 |
| **Open issues** | 23 |
| **Peer dependencies** | None |
| **Runtime dependencies** | argparse, entities, linkify-it, mdurl, punycode.js, uc.micro |

**React 19 compatibility**: Not a React library. Outputs HTML strings. Same situation as marked.

**SSR/Edge compatibility**: Good. No DOM dependency. Works in Node.js and edge runtimes. The `argparse` dependency adds some weight.

**Security**: markdown-it has built-in HTML sanitization via the `html` option (default: false, meaning HTML tags in markdown are not rendered). When `html: true` is set, it does NOT sanitize — you need DOMPurify. The default behavior is safer than marked.

**Tailwind prose integration**: Same as marked. Outputs HTML string, use `dangerouslySetInnerHTML` + prose container.

**Usage pattern with this project**:
```tsx
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const html = md.render(article.summary);
const sanitized = DOMPurify.sanitize(html);

<div className="prose prose-slate max-w-none dark:prose-invert"
  dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**Caveats**:
- Larger than marked (221KB vs 112KB package).
- Plugin system is more mature than marked's extensions — large plugin ecosystem.
- Stricter CommonMark compliance than marked.
- Typographer feature (smart quotes, em-dashes) is a nice-to-have for AI-generated content.
- linkify-it included for auto-linking URLs.
- TypeScript types available via `@types/markdown-it` (dev dependency).

---

#### 4. snarkdown (v2.0.0)

| Metric | Value |
|---|---|
| **npm package size** | 7.7 KB (gzipped tarball) |
| **Install size (node_modules)** | 72 KB, 1 package (zero dependencies) |
| **Weekly npm downloads** | ~113K |
| **GitHub stars** | 2,398 |
| **Last publish** | 2020-08-31 (nearly 6 years ago) |
| **Last repo push** | 2022-11-29 (last meaningful commit: 2020-08-31) |
| **Open issues** | 43 |
| **Peer dependencies** | None |
| **Runtime dependencies** | None |

**React 19 compatibility**: Not a React library. Outputs HTML strings. No React dependency.

**SSR/Edge compatibility**: Excellent. Tiny, no dependencies, pure JS.

**Security**: snarkdown does basic attribute encoding (`encodeAttr` escapes `"`, `<`, `>` in attributes) but is NOT a security-focused library. Image `src` and link `href` attributes are not fully sanitized. Must pair with DOMPurify.

**Tailwind prose integration**: Same pattern as marked/markdown-it. Output HTML string into prose container.

**Supported markdown syntax** (from source code review):
- Headings (h1-h6 via `#`)
- Bold (`**` or `__`), italic (`*` or `_`), strikethrough (`~~`)
- Code blocks (fenced with ```)
- Inline code (backticks)
- Links and images
- Blockquotes (`>`)
- Unordered lists (`-`, `*`, `+`) and ordered lists (`1.`)
- Horizontal rules (`---`, `***`)
- Line breaks (two spaces or `\n`)
- Reference-style links

**NOT supported**:
- Tables (no GFM table support)
- Task lists / checkboxes
- Footnotes
- Definition lists
- Any extension/plugin system

**Usage pattern with this project**:
```tsx
import snarkdown from 'snarkdown';

const html = snarkdown(article.summary);
const sanitized = DOMPurify.sanitize(html);

<div className="prose prose-slate max-w-none dark:prose-invert"
  dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**Caveats**:
- **Abandonware**: Last meaningful update was August 2020. 43 open issues, no maintainer response since 2022.
- No plugin/extension system — cannot add GFM tables, task lists, etc.
- The AI summary PRD mentions "3-5 bullet points" which uses standard list syntax, so snarkdown covers the basic need.
- However, LLMs commonly generate tables, task lists, and other GFM syntax that snarkdown cannot render.

---

### Summary Comparison Table

| Feature | react-markdown | marked | markdown-it | snarkdown |
|---|---|---|---|---|
| **Package size** | 15.5 KB | 111.9 KB | 221.1 KB | 7.7 KB |
| **Install footprint** | 7.9 MB / 77 pkgs | 464 KB / 1 pkg | 1.8 MB / 7 pkgs | 72 KB / 1 pkg |
| **React 19 compat** | Native (v10) | N/A (HTML string) | N/A (HTML string) | N/A (HTML string) |
| **Rendering mode** | React elements | HTML string | HTML string | HTML string |
| **dangerouslySetInnerHTML** | Not needed | Required | Required | Required |
| **GFM tables** | Via remark-gfm | Built-in | Via plugin | No |
| **GFM task lists** | Via remark-gfm | Built-in | Via plugin | No |
| **XSS protection** | Safe by default | Needs DOMPurify | Safe if html:false | Needs DOMPurify |
| **Plugin ecosystem** | Remark/rehype (huge) | Extensions (growing) | Plugins (mature) | None |
| **Maintenance** | Active | Very active | Active | Abandoned |
| **Weekly downloads** | 23.3M | 44.4M | 23.4M | 113K |
| **Prose integration** | Excellent (components prop) | Good | Good | Good |

### React 19 + react-markdown: Known Issues

1. **Issue #911** (closed): "JSX namespace is not defined in react 19+" — resolved in react-markdown v10. Some users on v10.1.0 still report similar TypeScript errors, which may be due to tsconfig settings rather than the library itself.

2. **Issue #920** (closed): "Add support for React 19" — closed as duplicate of #911, maintainer confirmed v10 supports React 19.

3. **v10 breaking change**: `className` prop was removed. Styling must be done via wrapper element or `components` prop.

4. **ESM-only**: v10 is ESM-only. Compatible with Vite 6 but may need attention for SSR setups.

### DOMPurify Integration Notes

The project already uses DOMPurify (v3.4.5) with a custom config for article content. For markdown rendering:

- **react-markdown**: DOMPurify is not needed if no `rehype-raw` plugin is used (markdown is safe by default). If `rehype-raw` is added for inline HTML, pair with `rehype-sanitize` or DOMPurify.
- **marked / markdown-it / snarkdown**: DOMPurify is required since these output raw HTML strings. The existing DOMPurify setup can be reused.

### Key Decision Factors for This Project

1. **AI summary content**: LLM outputs typically contain bullet lists, bold/italic, headers, and occasionally tables. GFM support is valuable.
2. **Summary area is small**: The rendering scope is limited (a summary box, not full articles). Performance differences are negligible for small markdown strings.
3. **Project already uses DOMPurify**: HTML-string-based libraries (marked, markdown-it, snarkdown) can reuse the existing sanitization.
4. **Project already uses prose classes**: All four libraries can integrate with Tailwind prose.
5. **Bundle size sensitivity**: react-markdown adds 85 packages / 7.9MB to node_modules. marked adds 1 package. For a Vite-bundled app, tree-shaking reduces the actual client bundle, but react-markdown's dependency tree is significantly heavier.
6. **Chat panel**: AIChatPanel (L148) also renders plain text. If markdown rendering is extended to chat, streaming markdown rendering is a consideration.

## Caveats / Not Found

- Actual tree-shaken bundle sizes for Vite production builds were not measured — only node_modules install sizes and npm tarball sizes.
- react-markdown v10.x has some user reports of TypeScript issues with React 19 that may be environment-specific; a test in this project's Vite+TS setup would confirm.
- snarkdown v2.0.0 is effectively abandoned; it is listed for completeness but carries significant risk due to no maintenance.
- The project uses npm mirror (npmmirror.com per package-lock.json), which may have different availability timelines for new versions.

### Related Specs

- `.trellis/spec/frontend/component-guidelines.md` — Prose Content Typography Override pattern (L95-120), explains how prose classes are used with inline styles
- `.trellis/tasks/05-26-ai-markdown/prd.md` — Task PRD with requirements and acceptance criteria
