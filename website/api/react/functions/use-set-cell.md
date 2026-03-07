# useSetCell

## Signature

```ts
useSetCell<T>(
  cell: Cell<T>,
  options?: { priority?: Priority; reason?: string }
): (next: T | ((prev: T) => T)) => void
```

## Description

Alias for `useCellAction`. Returns only a setter callback for the given cell, without reading its value.

Useful when a component only needs to write to a cell without subscribing to its changes.

## Parameters

- `cell`: the cell unit to write to.
- `options.priority`: update priority.
- `options.reason`: reason string for observability.

## Return Value

A setter function that accepts a value or updater function.

## Example

```tsx
const setFilter = useSetCell(filterCell, { reason: 'filter.change' });

return <input onChange={(e) => setFilter(e.target.value)} />;
```

## Related

- [useCellAction](/api/react/functions/use-cell-action)
- [useCell](/api/react/functions/use-cell)
- [react module index](/api/react)
