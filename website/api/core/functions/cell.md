# cell

## Signature

```ts
cell<T>(init: T, options?: UnitMeta & { equal?: (a: T, b: T) => boolean }): Cell<T>
```

## Description

Creates a mutable state unit.

## Parameters

- `init`: initial value stored in the cell.
- `options.id`: stable ID used by serializer/inspect.
- `options.debugName`: debug label.
- `options.serializable`: excludes cell from serialization when `false`.
- `options.equal`: custom equality check to suppress no-op updates.


## Literal Union Values

- `options.serializable`: `true | false` (default: `true`).

## Example

```ts
import { cell, createStore } from '@scope-flux/core';

const filterText = cell('', { id: 'todos.filterText' });
const store = createStore();
const scope = store.fork();

scope.set(filterText, 'urgent', { reason: 'filter.changed' });
console.log(scope.get(filterText)); // 'urgent'
```

## Notes

- Use `cell` for mutable source state such as form input, filters, and toggles.
- Add a stable `id` when the value must be serialized, hydrated, or inspected.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
