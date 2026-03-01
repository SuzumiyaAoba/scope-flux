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

## Example

```tsx
import { cell, event } from '@scope-flux/core';
import { useAction, useUnit } from '@scope-flux/react';

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

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
