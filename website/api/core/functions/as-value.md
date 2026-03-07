# asValue

## Signature

```ts
asValue<T>(value: T): ValueBox<T>
```

## Description

Wraps a raw value so that `scope.set()` treats it as a literal value, bypassing the function-updater detection.

This is necessary when storing function values in cells, since `scope.set(cell, fn)` would normally interpret `fn` as an updater `(prev) => next`.

## Parameters

- `value`: the value to wrap.

## Return Value

A `ValueBox<T>` wrapper.

## Example

```ts
import { cell, asValue, createStore } from '@suzumiyaaoba/scope-flux-core';

const handler = cell<(() => void) | null>(null, { id: 'handler' });
const scope = createStore().fork();

// Without asValue, this would be interpreted as an updater function:
scope.set(handler, asValue(() => console.log('hello')));
```

## Related

- [ValueBox type](/api/core/types/value-box)
- [core module index](/api/core)
