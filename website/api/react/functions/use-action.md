# useAction

## Signature

```ts
useAction(event, options?): (payload) => void
```

## Description

Returns event dispatcher callback.

## Parameters

- `event`: target event.
- `options.priority`: optional priority.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { cell, event } from '@suzumiyaaoba/scope-flux-core';
import { useAction, useUnit } from '@suzumiyaaoba/scope-flux-react';

const addTodo = event<{ title: string }>();
const pendingTitle = cell('', { id: 'todo.pendingTitle' });

function SubmitButton() {
  const title = useUnit(pendingTitle);
  const dispatchAddTodo = useAction(addTodo, { priority: 'urgent' });

  return <button onClick={() => dispatchAddTodo({ title })}>Add Todo</button>;
}
```

## Notes

- `useAction` is useful when a component emits intent and handler logic lives elsewhere.
- Keep payload fields explicit so event contracts stay stable as features grow.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
