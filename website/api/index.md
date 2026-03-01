# API

This section contains the conceptual API reference for each package.

## Package APIs

- [Core API](/api/core)
- [React API](/api/react)
- [Scheduler API](/api/scheduler)
- [Serializer API](/api/serializer)
- [Inspect API](/api/inspect)

## Generated Type Signatures

- [Typedoc](/typedoc/index.html)

Use the package pages first, then open Typedoc when you need exact signatures.

## Example

```ts
import { createStore, cell } from '@scope-flux/core';
import { serialize } from '@scope-flux/serializer';

const count = cell(0, { id: 'count' });
const scope = createStore().fork();
scope.set(count, 1);

const payload = serialize(scope);
console.log(payload.values.count); // 1
```

## Notes

- Start from each module page for behavior and argument details.
- Use Typedoc for exact type signatures and overloads.
