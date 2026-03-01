# NexState Implementation Plan

This document translates the architecture proposed in `deep-research-report.md` into an executable implementation plan.

## Scope and Objectives

Target: a next-generation React state management library (working name: NexState) for medium-to-large SPA/SSR apps in the React 19 era.

Primary goals:
- Keep tear-free rendering guarantees via `useSyncExternalStore` (uSES) contracts.
- Support practical transition-friendly UX via a two-layer update model.
- Provide safe SSR/RSC state transport by default.
- Make observability (Inspector/DevTools) first-class but removable in production.

Non-goals for initial versions:
- Built-in statechart runtime (integrate via adapters instead).
- Deep coupling with unstable RSC bundler internals.

## Guiding Decisions

- `uSES` compliance is mandatory in React bridge APIs.
- Scope-first design: avoid implicit global singleton stores.
- Core model: `Cell` + `Computed` + `Event/Effect`.
- Security-first serialization: JSON-only payload, validation, size limits.
- Instrumentation as optional packages to minimize production overhead.

## Delivery Phases

## Phase 0 - Specification Lock (Week 1)

Tasks:
- Finalize minimum public API surface:
  - `createStore`, `fork`
  - `cell`, `computed`
  - `event`, `effect`
  - `emit`, `set`, `batch`, `get`
  - `serialize`, `hydrate`
  - `StoreProvider`, `useUnit`, `useAction`
- Define explicit non-goals and extension boundaries.
- Write architecture decision records (ADRs) for:
  - uSES-first bridge
  - scope-first isolation
  - two-layer update model

Deliverables:
- `docs/spec-core.md`
- `docs/adr/*.md`

Exit criteria:
- API and behavioral contracts approved.
- Breaking/open questions closed or tracked.

## Phase 1 - Core Store MVP (Weeks 2-3)

Tasks:
- Implement core store runtime:
  - versioned state snapshots
  - subscription and batched notification
  - deterministic event/effect flow
- Implement `Cell`/`Computed` dependency graph and invalidation.
- Implement scoped store for request/test isolation.
- Add tests for snapshot immutability and cache semantics.

Deliverables:
- `packages/core`
- unit tests and contract tests

Exit criteria:
- Stable `get(unit)` semantics.
- No unnecessary recompute/re-render triggers in core tests.

## Phase 2 - React Bridge and SSR Baseline (Weeks 4-5)

Tasks:
- Implement React integration package:
  - `StoreProvider`
  - `useUnit` with selector support
  - `useAction`
- Implement uSES-compatible subscription bridge.
- Implement SSR state transport baseline:
  - `serialize(scope)`
  - `hydrate(scope, payload)`
  - `getServerSnapshot` compatibility path
- Add end-to-end SSR + hydration sample.

Deliverables:
- `packages/react`
- `packages/serializer` (baseline)
- SSR example app

Exit criteria:
- Hydration completes without mismatch in sample scenarios.
- Per-request scope isolation verified.

## Phase 3 - Security Hardening and Hydration Rules (Weeks 6-7)

Tasks:
- Enforce serialization constraints:
  - JSON-safe values only
  - schema validation on hydrate
  - payload size limits
- Add secure HTML embedding helper for preloaded state (XSS-safe escaping).
- Implement idempotent hydrate default behavior.
- Add optional `force` hydrate mode with warnings.
- Build security regression tests (malformed payload, type confusion, payload bombs).

Deliverables:
- hardened `packages/serializer`
- `docs/security.md`
- security-focused test suite

Exit criteria:
- Security regression tests pass.
- Unsafe payload paths fail closed.

## Phase 4 - Two-Layer Update Model (Weeks 8-9)

Tasks:
- Add update priorities:
  - `urgent`
  - `transition`
  - `idle`
- Implement coordinator behavior:
  - Committed Store for authoritative state
  - Buffered View for transition-friendly presentation state
- Ensure transition-path updates avoid mutating committed state in critical paths.
- Add benchmarks for input responsiveness and heavy derived rendering.

Deliverables:
- `packages/scheduler` (or coordinator module)
- benchmark harness and reports

Exit criteria:
- Demonstrable UX improvement for heavy UI updates.
- No regressions in tear-free guarantees for committed state.

## Phase 5 - Observability, Migration, and v1 Readiness (Weeks 10-11)

Tasks:
- Implement inspector as separate package:
  - event/state change logs
  - trace chains (event -> affected cells)
- Add Redux DevTools adapter.
- Publish migration guides:
  - Redux -> NexState
  - Zustand -> NexState
  - Jotai -> NexState
  - Valtio/MobX -> NexState (via `useTrack` option)
- Add release checklist and compatibility matrix.

Deliverables:
- `packages/inspect`
- migration docs under `docs/migration/`
- v1 release checklist

Exit criteria:
- Migration examples compile and run.
- Observability can be fully excluded from production bundle.

## Cross-Cutting Workstreams

## Testing Strategy

- Contract tests:
  - uSES snapshot cache and immutability behavior
  - SSR server/client snapshot consistency
- Concurrency tests:
  - transition boundaries
  - subscription ordering and batching
- Security tests:
  - deserialize validation
  - payload size caps
  - unsafe type rejection

## Packaging and Compatibility

- Separate entry points for core/react/inspect/serializer.
- Keep React bridge replaceable for potential future primitives (e.g. `use(store)`).
- Avoid dependencies on unstable framework internal APIs.

## Type Safety and Tooling

- Strong generics for `cell/computed/event/effect`.
- Payload typing for `serialize/hydrate`.
- Optional future plugin track:
  - stable ID auto-generation (Babel/SWC)
  - manifest output for unit-ID mapping

## Milestones

- M1 (end Week 3): Core MVP complete.
- M2 (end Week 5): React + SSR baseline complete.
- M3 (end Week 7): Security hardening complete.
- M4 (end Week 9): Two-layer update model complete.
- M5 (end Week 11): Observability + migration docs complete, v1 ready.

## Immediate Next Tasks (Start Now)

1. Scaffold `packages/core` with test runner and type checks.
2. Write uSES contract tests before bridge implementation.
3. Implement minimal `serialize/hydrate` with strict JSON checks.
4. Create an SSR sample to validate scope isolation from day one.
