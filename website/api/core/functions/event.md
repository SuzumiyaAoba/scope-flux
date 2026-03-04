# event

## Signature

```ts
event<P>(options?: { debugName?: string }): Event<P>
```

## Description

Creates a typed event channel.

## Parameters

- `options.debugName`: debug label.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts twoslash
import { cell, createStore, event } from '@suzumiyaaoba/scope-flux-core';

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

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
