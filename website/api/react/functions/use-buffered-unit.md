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

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { cell } from '@suzumiyaaoba/scope-flux-core';
import { useBufferedUnit, useCellAction, useFlushBuffered } from '@suzumiyaaoba/scope-flux-react';

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

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
