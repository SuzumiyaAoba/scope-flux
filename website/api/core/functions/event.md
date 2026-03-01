# event

## Signature

```ts
event<P>(options?: { debugName?: string }): Event<P>
```

## Description

Creates a typed event channel.

## Parameters

- `options.debugName`: debug label.

## Example

```ts
import { cell, createStore, event } from '@scope-flux/core';

const submitClicked = event<{ title: string }>({ debugName: 'todo.submit' });
const titles = cell<string[]>([], { id: 'todos.titles' });

const scope = createStore().fork();
scope.on(submitClicked, ({ title }, s) => {
  s.set(titles, (prev) => [...prev, title], { reason: 'todo.add' });
});

scope.emit(submitClicked, { title: 'Write docs' });
console.log(scope.get(titles)); // ['Write docs']
```

## Notes

- Use `event` for intent signals ("something happened"), not for persistent state.
- Register handlers in composition/root setup so event flow remains traceable.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
