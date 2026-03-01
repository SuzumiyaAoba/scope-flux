# useBufferedUnit

## Signature

```ts
useBufferedUnit(cell, selector?, options?)
```

## Description

Reads buffered value with committed fallback.

## Parameters

- `cell`: target cell.
- `selector`: optional value projector.
- `options.equality`: optional comparator for selected value.

## Example

```tsx
import { cell } from '@scope-flux/core';
import { useBufferedUnit, useCellAction, useFlushBuffered } from '@scope-flux/react';

const query = cell('', { id: 'query' });

function SearchInput() {
  const value = useBufferedUnit(query);
  const setQuery = useCellAction(query, { priority: 'transition', reason: 'search.typing' });
  const flush = useFlushBuffered();

  return (
    <input
      value={value}
      onChange={(e) => setQuery(e.target.value)}
      onBlur={() => flush()}
    />
  );
}
```

## Notes

- Use this for responsive typing UX where intermediate values can stay buffered.
- Call `flush` at clear commit boundaries (blur, submit, navigation).

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
