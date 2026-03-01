# Core Store Interface

## Type Model

```ts
export type StableId = string;
export type Priority = 'urgent' | 'transition' | 'idle';

export interface UnitMeta {
  id?: StableId;
  debugName?: string;
  serializable?: boolean;
}

export interface Cell<T> {
  kind: 'cell';
  meta: UnitMeta;
  init: T;
  equal?: (a: T, b: T) => boolean;
}

export interface Computed<T> {
  kind: 'computed';
  meta: UnitMeta;
  read: (ctx: ReadContext) => T;
  cache?: 'scope' | 'none';
}

export interface Event<P> {
  kind: 'event';
  meta: UnitMeta;
}

export interface Effect<P, R> {
  kind: 'effect';
  meta: UnitMeta;
  handler: (payload: P, ctx: EffectContext) => Promise<R> | R;
}
```

## Store and Scope

```ts
export interface Store {
  fork(seed?: SeedInput): Scope;
}

export interface Scope {
  id: string;

  get<T>(unit: Cell<T> | Computed<T>): T;

  set<T>(cell: Cell<T>, next: T | ((prev: T) => T), opts?: UpdateOptions): void;

  emit<P>(event: Event<P>, payload: P, opts?: UpdateOptions): void;

  run<P, R>(effect: Effect<P, R>, payload: P, opts?: UpdateOptions): Promise<R>;

  batch<T>(fn: () => T, opts?: UpdateOptions): T;

  subscribe(listener: ScopeListener): Unsubscribe;
}

export interface UpdateOptions {
  priority?: Priority;
  reason?: string;
}
```

## Behavioral Contracts

- `computed.read` must be pure and side-effect free.
- `get(computed)` caches by dependency versions when `cache='scope'`.
- Within a committed update transaction:
  - all writes are applied before subscriber flush.
  - subscriber receives a stable post-commit snapshot.
- Dependency cycles in computed graph throw deterministic runtime errors.

## Error Codes (Draft)

- `NS_CORE_CYCLE_DETECTED`
- `NS_CORE_IMPURE_COMPUTED`
- `NS_CORE_MISSING_HANDLER`
- `NS_CORE_INVALID_UPDATE`
