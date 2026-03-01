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

## Example

```tsx
import { cell, computed } from '@scope-flux/core';
import { useUnit } from '@scope-flux/react';

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

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
