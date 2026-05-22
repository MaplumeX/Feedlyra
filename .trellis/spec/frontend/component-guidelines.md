# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

- **Tailwind utility classes** inline in JSX (no CSS modules, no styled-components)
- Theme via CSS custom properties in `index.css` (`:root` / `.dark`), mapped through `tailwind.config.ts`
- shadcn/ui components for primitives (Button, Badge, DropdownMenu, etc.)

### Layout Convention: Three-Panel Fixed Layout

The main reader layout uses a **fixed-width CSS flex** three-panel structure — NOT `react-resizable-panels`.

**Why**: Resizable panels caused the sidebar to render too narrow and the drag handle was unwanted. Fixed widths ensure consistent content display.

```
div.flex.h-full
  ├── Sidebar wrapper:   w-64 (256px), shrink-0, collapsible (sidebarCollapsed state)
  ├── Article list:      w-[360px], shrink-0, border-r border-border
  └── Article detail:    flex-1 min-w-0
```

**Collapse behavior**: When `sidebarCollapsed` is true, the sidebar wrapper shrinks to 40px and shows a `PanelLeft` icon button to re-expand. Controlled by zustand store (`sidebarCollapsed`), toggled via Shift+S shortcut and Command Palette.

> **Warning**: Do not re-introduce `react-resizable-panels` for the sidebar. The resizable pattern is inappropriate when panel content (feed list, article titles) needs a predictable minimum width to remain readable.

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

- **Using resizable panels for fixed-content sidebars** — `react-resizable-panels` lets users shrink panels below readable widths. For content that needs predictable sizing (feed lists, navigation), use fixed-width CSS flex layout instead.
