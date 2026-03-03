# React API

`@suzumiyaaoba/scope-flux-react` connects core/scheduler to React rendering.

This package provides two things:

- Provider boundary (`StoreProvider`)
- hooks for reading and writing units in components

## Provider

### `StoreProvider({ scope, scheduler?, children })`
Injects scope (and optional scheduler) into React context.

- Always place this above hooks usage.
- If `scheduler` is omitted, a default scheduler is created for the scope.

Recommended placement:

- application root for normal SPA usage
- request boundary for SSR (new scope per request)

## Read Hooks

### `useUnit(unit)`
Reads committed state from `cell`/`computed`.

Use this as your default read hook.

### `useUnit(unit, selector, { equality? })`
Reads a selected slice and reduces re-renders.

When to use:
- Large objects where component needs only a small part.

Example:

- full user profile in cell
- component selects only `profile.displayName`

### `useBufferedUnit(cell)`
Reads buffered value if present; falls back to committed state.

### `useBufferedUnit(cell, selector, { equality? })`
Buffered read + selection.

When to use:
- Transition-style UX where UI can temporarily show buffered state.

## Write Hooks

### `useCell(cell, { priority?, reason? })`
Returns a tuple `[value, setValue]` similar to `useState`.

- Internally combines `useUnit(cell)` and `useCellAction(cell, options)`.
- Useful when you want read/write in one line.

Example:

```tsx
const [query, setQuery] = useCell(queryCell, {
  priority: 'transition',
  reason: 'search.typing',
});

setQuery('scope-flux');
setQuery((prev) => prev.toUpperCase());
```

### `useCellAction(cell, { priority?, reason? })`
Returns typed setter for a cell.

- `urgent`: commit immediately.
- `transition`/`idle`: write into scheduler buffer first.

Use `reason` for better inspect traces in debugging:

```tsx
const setQuery = useCellAction(queryCell, { priority: 'transition', reason: 'search.typing' });
```

### `useFlushBuffered()`
Commits buffered values into authoritative state in batch.

Good flush timings:

- `onBlur`
- submit/add button click
- navigation boundary before leaving the page

### `useAction(event, { priority? })`
Returns event dispatcher.

### `useEffectAction(effect, { priority? })`
Returns async effect invoker.

### `useEffectStatus(effect)`
Returns live runtime status of the target effect.

Includes `running`, `queued`, `lastResult`, `lastError`, and timestamps.

### `useAsyncEffectAction(effect, options?)`
High-level helper combining:

- `run(payload)` (same as `useEffectAction`)
- `cancel()` (calls `scope.cancelEffect`)
- `status` (same as `useEffectStatus`)

## Arguments Reference

### `StoreProvider({ scope, scheduler?, children })`

- `scope: Scope`
  - Scope used by hooks for reads/writes.
- `scheduler?: Scheduler`
  - If omitted, `createScheduler({ scope })` is created automatically.
- `children: ReactNode`
  - Descendants can use the hooks.

### `useUnit(unit, selector?, options?)`

- `unit: Cell<T> | Computed<T>`
  - Unit to read from.
- `selector?: (value: T) => S`
  - Picks a slice from the full value.
- `options?: { equality?: (a: S, b: S) => boolean }`
  - Equality check for selected value. Default is `Object.is`.

### `useBufferedUnit(cell, selector?, options?)`

- `cell: Cell<T>`
  - Cell to read from buffered channel.
- `selector?: (value: T) => S`
- `options?: { equality?: (a: S, b: S) => boolean }`

### `useCell(cell, options?)`

- `cell: Cell<T>`
  - Cell for combined read/write access.
- `options?: { priority?: Priority; reason?: string }`
  - Update options passed to setter (`useCellAction`).
- Returns: `[value, setValue]`
  - `value: T`
  - `setValue: (next: T | ((prev: T) => T)) => void`

### `useCellAction(cell, options?)`

- `cell: Cell<T>`
- `options?: { priority?: Priority; reason?: string }`
  - `priority` default is `'urgent'`.
  - `reason` is an optional diagnostics/trace label.
- Returns: `(next: T | ((prev: T) => T)) => void`

### `useFlushBuffered()`

- No arguments.
- Returns: `() => void`
  - Commits scheduler buffered updates.

### `useAction(event, options?)`

- `event: Event<P>`
- `options?: { priority?: Priority }`
- Returns: `(payload: P) => void`

### `useEffectAction(effect, options?)`

- `effect: Effect<P, R>`
- `options?: { priority?: Priority }`
- Returns: `(payload: P) => Promise<R>`

### `useEffectStatus(effect)`

- `effect: Effect<P, R>`
- Returns: `EffectStatus<R>`

### `useAsyncEffectAction(effect, options?)`

- `effect: Effect<P, R>`
- `options?: { priority?: Priority }`
- Returns:
  - `run: (payload: P) => Promise<R>`
  - `cancel: () => void`
  - `status: EffectStatus<R>`

## Literal Union Values

### `Priority` (`useCell` / `useCellAction` / `useAction` / `useEffectAction`)

- `'urgent'`
  - Immediate commit.
- `'transition'`
  - Staged update into scheduler buffer.
- `'idle'`
  - Low-priority staged update into scheduler buffer.

## Pattern: Input Fast, Commit Controlled

```tsx
const query = cell('', { id: 'query' });

function SearchInput() {
  const value = useBufferedUnit(query);
  const setQuery = useCellAction(query, { priority: 'transition' });
  const flush = useFlushBuffered();

  return (
    <input
      value={value}
      onChange={(e) => setQuery(e.target.value)}
      onBlur={() => flush()} // commit authoritative value when interaction ends
    />
  );
}
```

## Hook Typing Preview (Twoslash)

```ts twoslash
type Cell<T> = { value: T };
type SetStateAction<T> = T | ((prev: T) => T);

declare function useCell<T>(cell: Cell<T>): [T, (next: SetStateAction<T>) => void];
declare function useCellAction<T>(cell: Cell<T>): (next: SetStateAction<T>) => void;

const queryCell = {} as Cell<string>;
const [query, setQuery2] = useCell(queryCell);
const setQuery = useCellAction(queryCell);

setQuery('scope-flux');
setQuery2((prev) => prev + '!');
setQuery((prev) => prev.toUpperCase());
```

Why this pattern is useful:

- input feels responsive during rapid typing
- heavy recomputations can wait until flush
- canonical committed state stays explicit

## Common Pitfalls

- Using hooks outside `StoreProvider`.
- Expecting buffered writes to appear in committed state before `flushBuffered`.
- Using broad selectors without `equality` for large objects.
- Creating a new scope inside render functions (causes unstable state lifecycle).

## Example

```tsx
import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import { StoreProvider, useCell } from '@suzumiyaaoba/scope-flux-react';

const queryCell = cell('', { id: 'query' });
const scope = createStore().fork();

function SearchBox() {
  const [query, setQuery] = useCell(queryCell, {
    priority: 'transition',
    reason: 'search.typing',
  });
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}

export function App() {
  return (
    <StoreProvider scope={scope}>
      <SearchBox />
    </StoreProvider>
  );
}
```

## Notes

- `useCell` returns `[value, setter]` and is the closest API to React `useState`.
- For expensive updates, combine `useCellAction` with `useFlushBuffered`.


## Reading Guide

- Start with this page for concepts and argument intent.
- Open `/api/<module>/functions/*` for operational usage patterns.
- Open `/api/<module>/types/*` for boundary contracts and type-level constraints.

## Production Checklist

- Define stable IDs for states that must be serialized or inspected.
- Attach `reason` metadata for important updates and side effects.
- Prefer explicit flush/hydration boundaries rather than implicit state transitions.
