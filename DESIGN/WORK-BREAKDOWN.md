# Work Breakdown

This document decomposes `PLAN.md` into implementation-ready tasks.

## Ticket Format

- ID: stable identifier for tracking.
- Outcome: measurable completion goal.
- Dependencies: required prior tasks.
- Acceptance: objective completion criteria.

## Phase 0: Specification Lock

### P0-001 API Surface Freeze
- Outcome: freeze v1 API names, signatures, and lifecycle guarantees.
- Dependencies: none.
- Acceptance:
  - `02-core-store-if.md` and `03-react-bridge-if.md` approved.
  - No unresolved naming conflicts.

### P0-002 ADR Set
- Outcome: capture key decisions and rejected alternatives.
- Dependencies: P0-001.
- Acceptance:
  - ADR for uSES-first bridge.
  - ADR for scope-first isolation.
  - ADR for two-layer update model.

### P0-003 Non-goals and Extension Points
- Outcome: prevent scope creep.
- Dependencies: P0-001.
- Acceptance:
  - statechart-in-core explicitly out of scope.
  - extension interfaces listed (machine adapter, persistence adapter).

## Phase 1: Core Store MVP

### P1-001 Runtime Skeleton
- Outcome: package structure and build/test setup in `packages/core`.
- Dependencies: P0-001.
- Acceptance:
  - typecheck + tests run in CI.
  - public exports compile.

### P1-002 Unit Primitives (`cell`, `computed`, `event`, `effect`)
- Outcome: construct core units with metadata and stable identity.
- Dependencies: P1-001.
- Acceptance:
  - type inference works for all primitives.
  - debug metadata preserved in runtime graph.

### P1-003 Graph + Invalidation Engine
- Outcome: dependency graph with minimal recomputation.
- Dependencies: P1-002.
- Acceptance:
  - computed recomputes only on dependency change.
  - cycle detection returns deterministic error.

### P1-004 Scoped Store + Forking
- Outcome: request/test isolation via `fork(seed?)`.
- Dependencies: P1-002.
- Acceptance:
  - parent and child scopes do not leak updates.
  - seeded values override defaults only in target scope.

### P1-005 Transactions and Batched Notifications
- Outcome: `batch()` semantics and subscriber coalescing.
- Dependencies: P1-003.
- Acceptance:
  - one notification flush per batch commit.
  - nested batch behavior documented and tested.

### P1-006 Core Contract Tests
- Outcome: immutable snapshot and cache consistency tests.
- Dependencies: P1-005.
- Acceptance:
  - mutation of returned snapshots impossible or blocked.
  - unchanged snapshots remain `Object.is` equal.

## Phase 2: React Bridge + SSR Baseline

### P2-001 React Provider and Context Boundary
- Outcome: `StoreProvider` and client-only boundary behavior.
- Dependencies: P1-006.
- Acceptance:
  - missing provider error is deterministic.
  - nested providers override outer scope safely.

### P2-002 `useUnit` Hook with Selector Equality
- Outcome: selector subscriptions with custom equality option.
- Dependencies: P2-001.
- Acceptance:
  - selector path re-renders only on selected value change.
  - equality override tested.

### P2-003 uSES Bridge Compliance
- Outcome: subscribe/getSnapshot/getServerSnapshot contract implementation.
- Dependencies: P2-002.
- Acceptance:
  - no unstable `getSnapshot` identity churn.
  - SSR server/client snapshot parity passes tests.

### P2-004 Baseline Serializer/Hydrator
- Outcome: minimal `serialize` and `hydrate` for SSR bootstrap.
- Dependencies: P1-004.
- Acceptance:
  - payload includes version + scope id + stable id map.
  - hydrate reproduces server initial values.

### P2-005 SSR Example App
- Outcome: executable reference for render -> embed -> hydrate.
- Dependencies: P2-003, P2-004.
- Acceptance:
  - hydration mismatch absent in e2e scenario.

## Phase 3: Security Hardening

### P3-001 Strict JSON Guardrails
- Outcome: reject non-JSON values at serialization boundary.
- Dependencies: P2-004.
- Acceptance:
  - function/class/symbol/bigint payloads rejected.
  - error code taxonomy documented.

### P3-002 Hydration Validation and Size Limits
- Outcome: schema + payload size enforcement.
- Dependencies: P3-001.
- Acceptance:
  - malformed payload fails closed.
  - oversize payload rejected with explicit error.

### P3-003 XSS-safe Embedding Helper
- Outcome: safe HTML script embedding helper.
- Dependencies: P2-004.
- Acceptance:
  - `<` and dangerous separators escaped.
  - helper usage documented in SSR example.

### P3-004 Idempotent Hydrate + Force Mode
- Outcome: default idempotent behavior with optional force override.
- Dependencies: P3-002.
- Acceptance:
  - repeated hydrate does not overwrite by default.
  - force mode emits warning hook.

### P3-005 Security Regression Suite
- Outcome: automated negative tests for payload attacks.
- Dependencies: P3-004.
- Acceptance:
  - malformed/type-confusion/size-bomb tests pass.

## Phase 4: Two-layer Update Model

### P4-001 Priority API
- Outcome: `urgent | transition | idle` update options.
- Dependencies: P2-002.
- Acceptance:
  - priority propagation visible in traces.

### P4-002 Coordinator Runtime
- Outcome: separated committed and buffered channels.
- Dependencies: P4-001.
- Acceptance:
  - transition updates never directly mutate committed state path.

### P4-003 Buffered View Integration with React
- Outcome: transition-safe view buffering via bridge hooks.
- Dependencies: P4-002, P2-003.
- Acceptance:
  - typing responsiveness improves under heavy derived rendering.

### P4-004 Benchmarks
- Outcome: reproducible benchmark harness and report template.
- Dependencies: P4-003.
- Acceptance:
  - baseline vs two-layer metrics generated automatically.

## Phase 5: Observability + Migration + v1

### P5-001 Inspector Package
- Outcome: log stream + trace graph APIs in `packages/inspect`.
- Dependencies: P1-005.
- Acceptance:
  - event -> unit impact chain query supported.

### P5-002 Redux DevTools Adapter
- Outcome: bridge from internal logs to DevTools protocol.
- Dependencies: P5-001.
- Acceptance:
  - action timeline visible in DevTools.

### P5-003 Migration Guides
- Outcome: strategy docs and code samples by source library.
- Dependencies: P2-004.
- Acceptance:
  - Redux/Zustand/Jotai/Valtio(MobX) docs published.

### P5-004 Production Exclusion Validation
- Outcome: verify inspect/devtools modules are tree-shakable.
- Dependencies: P5-001, P5-002.
- Acceptance:
  - production build contains no inspect code path.

## Parallel Tracks

- DX Track: examples, docs site, API reference generation.
- Tooling Track: optional stable-ID transformer (Babel/SWC).
- Compatibility Track: React minor compatibility matrix.
