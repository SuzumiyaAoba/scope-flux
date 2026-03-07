# combine

## Signature

```ts
combine<const D extends ComputedDeps>(deps: D, options?: { debugName?: string; cache?: "scope" | "none" }): Computed<{ [K in keyof D]: UnitValue<D[K]> }, D>
```

## Description

Shorthand for creating a `computed` that returns a tuple of all dependency values. Equivalent to `computed(deps, (...args) => args)`.

## Parameters

- `deps`: dependency units (cells or computeds) in evaluation order.
- `options.debugName`: debug label.
- `options.cache`: cache strategy (`'scope'` default, `'none'` to recompute every read).

## Return Value

- A `Computed` unit whose value is a tuple of all dependency values.

## Example

```ts twoslash
import { cell, computed, combine, createStore } from '@suzumiyaaoba/scope-flux-core';

const name = cell('Alice', { id: 'combine.name' });
const age = cell(30, { id: 'combine.age' });
const profile = combine([name, age]);

const scope = createStore().fork();
console.log(scope.get(profile)); // ['Alice', 30]

scope.set(name, 'Bob');
console.log(scope.get(profile)); // ['Bob', 30]
```

## Notes

- The result is a standard `Computed` and caches like any other computed.
- Use `combine` when you want to subscribe to multiple cells as a single unit.
- For custom derivation logic, use `computed` directly instead.

## Related

- [computed](/api/core/functions/computed)
- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
