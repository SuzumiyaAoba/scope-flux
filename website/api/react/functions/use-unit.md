# useUnit

## Signature

```ts
useUnit(unit, selector?, options?)
```

## Description

Reads committed value from cell/computed with optional selector.

## Parameters

- `unit`: cell or computed to read.
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
import { cell, computed } from '@suzumiyaaoba/scope-flux-core';
import { useUnit } from '@suzumiyaaoba/scope-flux-react';

const todos = cell(
  [
    { id: '1', done: false },
    { id: '2', done: true },
  ],
  { id: 'todos.items' },
);
const remaining = computed([todos], (items) => items.filter((t) => !t.done).length);

function RemainingBadge() {
  const count = useUnit(remaining);
  return <strong>{count} remaining</strong>;
}
```

## Notes

- Use `useUnit` as your default read hook for `cell` and `computed`.
- Add selector/equality options when you need fine-grained rerender control.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
