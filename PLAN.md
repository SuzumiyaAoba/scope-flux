# scope-flux Implementation Plan

This plan is managed as a task list so progress can be tracked directly in the file.

## Progress Summary

- [x] Phase 0: Specification Lock
- [x] Phase 1: Core Store MVP
- [x] Phase 2: React Bridge and SSR Baseline
- [x] Phase 3: Security Hardening and Hydration Rules
- [x] Phase 4: Two-layer Update Model
  - Progress: buffered runtime + React integration + benchmark harness implemented
- [x] Phase 5: Observability, Migration, and v1 Readiness
  - Progress: inspector + trace/diff stream + adapter + guides + exclusion verification implemented

## Phase 0 - Specification Lock

- [x] Freeze v1 API surface (`createStore`, `cell`, `computed`, `event`, `effect`, `serialize`, `hydrate`, React hooks)
- [x] Define non-goals and extension boundaries
- [x] Document architecture and interfaces under `DESIGN/`

## Phase 1 - Core Store MVP

- [x] Implement core runtime (`packages/core`)
- [x] Implement dependency graph + computed cache + cycle detection
- [x] Implement scope forking and isolation
- [x] Implement batch/subscribe semantics
- [x] Add unit tests for runtime contracts

## Phase 2 - React Bridge and SSR Baseline

- [x] Implement React package (`packages/react`)
- [x] Implement `StoreProvider`, `useUnit`, `useAction`, `useEffectAction`
- [x] Implement uSES-based subscription bridge
- [x] Implement serializer baseline (`packages/serializer`)
- [x] Add tests for bridge and SSR state roundtrip

## Phase 3 - Security Hardening and Hydration Rules

- [x] Enforce JSON-only serialization values
- [x] Add payload size limit
- [x] Add idempotent hydrate (`safe`) and overwrite mode (`force`)
- [x] Add XSS-safe JSON embedding helper
- [x] Add security-oriented tests for serializer

## Phase 4 - Two-layer Update Model

- [x] Add scheduler package scaffold (`packages/scheduler`)
- [x] Implement priority-aware update paths (`urgent`, `transition`, `idle`)
- [x] Implement buffered update queue and `flushBuffered()`
- [x] Add scheduler unit tests
- [x] Integrate buffered path with React bridge (`transition` rendering integration)
- [x] Add benchmark harness for heavy rendering scenarios

## Phase 5 - Observability, Migration, and v1 Readiness

- [x] Implement inspector package (`packages/inspect`)
- [x] Add trace event model and state diff stream
- [x] Add Redux DevTools adapter
- [x] Publish migration guides (Redux/Zustand/Jotai/Valtio/MobX)
- [x] Verify observability can be excluded from production bundles

## Cross-cutting Tasks

- [x] Migrate tests to Vite/Vitest
- [x] Keep TypeScript project references for all packages
- [x] Add CI workflow for `build` + `test`
- [x] Add API docs generation

## Current Focus

1. Release checklist and versioning strategy.
2. Documentation polish and examples.
