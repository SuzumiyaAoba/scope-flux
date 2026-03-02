# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

scope-flux is a TypeScript-first state management library for modern React apps. It provides scope-based isolation, buffered updates, safe SSR hydration, and first-class observability.

## Commands

All commands run from the repo root:

- `npm run build` — clean + build all packages (tsup)
- `npm run typecheck` — strict type check via tsc (no emit)
- `npm test` — run all tests (Vitest)
- `npm run test:watch` — watch mode
- `npm run test:coverage` — tests with v8 coverage (thresholds: lines 85%, statements 85%, functions 90%, branches 80%)
- `npm run lint:ids` — check for duplicate `cell({ id })` values
- `npm run verify:observability` — ensure inspect package doesn't leak into runtime bundles
- `npm run docs:dev` — Rspress docs dev server (port 3000)
- `npm run samples:all` — build + run all samples

To run a single test file: `npx vitest run packages/<name>/test/<name>.test.ts`

## Architecture

TypeScript monorepo using **npm workspaces**. All packages are **ESM-only** (`type: "module"`, target `es2022`).

### Package dependency graph

```
core (no deps)
├── scheduler → core
├── serializer → core
├── inspect → core
└── react → core + scheduler + react@19
```

### Key packages

- **`@scope-flux/core`** — Foundation. Single-file (`src/index.ts`) with all primitives: `cell`, `computed`, `event`, `effect`, `Scope`, `createStore`. Units are plain objects with a `kind` discriminant. Version tracking drives cache invalidation. Commit batching via `_batchDepth` counter.
- **`@scope-flux/scheduler`** — `Scheduler` class for transition/idle priority buffering.
- **`@scope-flux/serializer`** — `serialize()`/`hydrate()` for SSR. Relies on cell `id` for lookup via global `registeredCellsById`.
- **`@scope-flux/inspect`** — Observability (`inspect()`, `connectDevtools()`, Redux DevTools adapter). Must be tree-shakeable and excluded from production bundles.
- **`@scope-flux/react`** — React 19 hooks: `StoreProvider`, `useUnit`, `useBufferedUnit`, `useCell`, `useCellAction`, `useAction`, `useEffectAction`, `useFlushBuffered`.

### Invariants

1. **Observability boundary**: `@scope-flux/inspect` must never appear in built output of `core`, `react`, `scheduler`, or `serializer`. Verified by `npm run verify:observability`.
2. **Unique cell IDs**: Cell `id` values must be globally unique. Verified by `npm run lint:ids`.
3. **Test cell IDs**: Cell IDs in tests must be unique strings to avoid global registry collisions between test runs.

## Coding Conventions

- TypeScript strict mode, `module: NodeNext`
- 2-space indentation
- Package entrypoints: `src/index.ts` or `src/index.tsx`
- Test files: `packages/<name>/test/<name>.test.ts(x)` (not in `src/`)
- Vitest aliases resolve `@scope-flux/*` to source (not dist) during testing
- Priority levels: `'urgent' | 'transition' | 'idle'`
- Error code namespace: `NS_CORE_*`, `NS_SER_*`, `NS_REACT_*`

## Commit Style

Conventional Commits scoped by package: `feat(react): add useCell hook`, `fix(core): ...`, `docs(api): ...`, `test(scheduler): ...`
