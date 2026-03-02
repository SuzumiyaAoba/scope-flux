# listRegisteredCells

## Signature

```ts
listRegisteredCells(): AnyCell[]
```

## Description

Returns all globally registered cells.

## Parameters

- No parameters.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

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

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
