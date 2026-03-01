# useCellAction

## Signature

```ts
useCellAction(cell, options?): (next) => void
```

## Description

Returns typed setter for cell updates.

## Parameters

- `cell`: target cell.
- `options.priority`: update priority (default `urgent`).
- `options.reason`: optional diagnostic reason.


## Literal Union Values

- `priority = "urgent"`: immediate commit.
- `priority = "transition"`: staged buffered update.
- `priority = "idle"`: low-priority staged buffered update.

## Example

```tsx
import { cell } from '@scope-flux/core';
import { useCellAction, useUnit } from '@scope-flux/react';

const count = cell(0, { id: 'count' });

function Counter() {
  const value = useUnit(count);
  const setCount = useCellAction(count, { reason: 'counter.click' });

  return <button onClick={() => setCount((prev) => prev + 1)}>count: {value}</button>;
}
```

## Notes

- Choose this hook when a component needs write access without owning read logic.
- Use updater form `(prev) => next` when next value depends on current state.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
