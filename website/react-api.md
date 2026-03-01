# React API

`@scope-flux/react` connects core/scheduler to React rendering.

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

declare function useCellAction<T>(cell: Cell<T>): (next: SetStateAction<T>) => void;

const queryCell = {} as Cell<string>;
const setQuery = useCellAction(queryCell);

setQuery('scope-flux');
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
