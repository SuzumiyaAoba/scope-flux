# React Bridge Interface

## Public API

```ts
export interface StoreProviderProps {
  scope: Scope;
  children: React.ReactNode;
}

export function StoreProvider(props: StoreProviderProps): JSX.Element;

export function useUnit<T>(unit: Cell<T> | Computed<T>): T;

export function useUnit<T, S>(
  unit: Cell<T> | Computed<T>,
  selector: (value: T) => S,
  options?: { equality?: (a: S, b: S) => boolean }
): S;

export function useAction<P>(
  event: Event<P>,
  options?: { priority?: Priority }
): (payload: P) => void;

export function useEffectAction<P, R>(
  effect: Effect<P, R>,
  options?: { priority?: Priority }
): (payload: P) => Promise<R>;
```

## uSES Contract Requirements

- `getSnapshot` returns immutable and cached snapshots.
- Snapshot identity remains stable if observed values did not change.
- `subscribe` callback triggers after committed updates only.
- `getServerSnapshot` must match first client snapshot in SSR hydration.

## Boundary Rules

- React bridge package is client-only.
- Core runtime can run in Node without React dependency.
- Missing provider behavior:
  - throw `NS_REACT_SCOPE_NOT_FOUND` in development.
  - optional fallback to default scope is explicitly disabled by default.

## Selector Semantics

- Selector execution is synchronous and pure.
- Equality default: `Object.is`.
- If selector throws, hook rethrows in render phase.

## Transition-related API Surface

- `useAction(..., { priority: 'transition' })` routes updates through scheduler buffer.
- Transition priority does not mutate committed path directly.
