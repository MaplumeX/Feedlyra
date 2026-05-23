# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development in the Feedlyra project. Each file documents real conventions derived from the codebase.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition, styling | Done |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching, SSE streaming | Done |
| [State Management](./state-management.md) | Zustand, React Query, state categories | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Type Safety](./type-safety.md) | TypeScript, Zod, type organization | Done |

---

## Key Conventions

- **React 19** + TypeScript (strict mode) + Vite
- **UI library**: shadcn/ui (Radix primitives) + Tailwind CSS v3
- **State split**: Zustand for UI/auth state, React Query for server data — no overlap
- **i18n**: i18next with `en`/`zh-CN` locales, Zod i18n integration
- **Forms**: react-hook-form + Zod validation
- **No tests** — currently not configured

---

**Language**: All documentation should be written in **English**.
