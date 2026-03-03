# getRegisteredCellById

## Signature

```ts
getRegisteredCellById(id: string): AnyCell | undefined
```

## Description

Returns a globally registered cell by stable ID.

## Parameters

- `id`: stable cell ID.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts
import { cell, getRegisteredCellById } from '@suzumiyaaoba/scope-flux-core';

const theme = cell<'light' | 'dark'>('light', { id: 'ui.theme' });
const resolved = getRegisteredCellById('ui.theme');

if (resolved === theme) {
  console.log('resolved registered cell successfully');
}
```

## Notes

- This API is mainly for tooling/integration code that resolves cells by stable id.
- In normal app logic, prefer direct cell references over global id lookup.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
