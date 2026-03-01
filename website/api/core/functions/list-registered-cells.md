# listRegisteredCells

## Signature

```ts
listRegisteredCells(): AnyCell[]
```

## Description

Returns all globally registered cells.

## Parameters

- No parameters.

## Example

```ts
import { cell, listRegisteredCells } from '@scope-flux/core';

cell(0, { id: 'counter.value' });
cell('', { id: 'search.query' });

const cells = listRegisteredCells();
for (const c of cells) {
  console.log(c.meta.id);
}
```

## Notes

- Useful for diagnostics and custom tooling that needs a catalog of registered cells.
- Treat the result as introspection data, not as a primary domain API.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
