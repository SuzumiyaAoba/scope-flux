# Scheduler and Two-layer Update Model

## Goal

Preserve tear-free correctness in committed state while enabling transition-friendly rendering for heavy presentation updates.

## Conceptual Layers

- Committed Store
  - authoritative state
  - feeds uSES snapshots
  - used for business-critical consistency
- Buffered View
  - presentation-oriented delayed state
  - consumed by transition paths
  - may lag behind committed state

## Priority Semantics

- `urgent`
  - writes committed store immediately
  - synchronous subscriber flush (batched)
- `transition`
  - writes buffered view channel
  - reflected via React transition path
- `idle`
  - deferred scheduling, downgraded/upgraded by runtime policy

## Interfaces

```ts
export interface Scheduler {
  enqueue(update: PendingUpdate): void;
  flushCommitted(): void;
  flushBuffered(): void;
}

export interface PendingUpdate {
  scope: Scope;
  priority: Priority;
  apply: () => void;
  traceId?: string;
}
```

## Invariants

- Transition updates do not mutate committed source during buffered render path.
- Urgent updates are never blocked by pending transition queue.
- Buffer invalidation occurs when committed dependencies diverge beyond policy.

## Failure Handling

- Buffer inconsistency triggers fallback to committed snapshot.
- Runtime emits diagnostic event for dropped buffered updates.

## Open Design Point

- Idle scheduling backend (`requestIdleCallback`, timers, host scheduler) is implementation-specific and should stay pluggable.
