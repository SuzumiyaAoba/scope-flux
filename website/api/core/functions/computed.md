# computed

## Signature

```ts
computed<const D extends ComputedDeps, T>(deps: D, read: (...args: ComputedArgs<D>) => T, options?: { debugName?: string; cache?: "scope" | "none" }): Computed<T, D>
```

## Description

Creates a derived unit from dependencies.

## Parameters

- `deps`: dependency units in evaluation order.
- `read`: pure derivation function.
- `options.debugName`: debug label.
- `options.cache`: cache strategy.


## Literal Union Values

- `options.cache = "scope"`: cache by dependency versions (default).
- `options.cache = "none"`: recompute on each read.

## Example

```ts
import { cell, computed, createStore } from '@scope-flux/core';

const todos = cell(
  [
    { id: '1', done: false },
    { id: '2', done: true },
  ],
  { id: 'todos.items' },
);
const remainingCount = computed([todos], (items) => items.filter((t) => !t.done).length);

const scope = createStore().fork();
console.log(scope.get(remainingCount)); // 1
```

## Notes

- Keep `computed` pure and deterministic to preserve cache correctness.
- Use it for derived view state instead of duplicating derived data in cells.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
