# getRegisteredCellById

## Signature

```ts
getRegisteredCellById(id: string): AnyCell | undefined
```

## Description

Returns a globally registered cell by stable ID.

## Parameters

- `id`: stable cell ID.

## Example

```ts
import { cell, getRegisteredCellById } from '@scope-flux/core';

const theme = cell<'light' | 'dark'>('light', { id: 'ui.theme' });
const resolved = getRegisteredCellById('ui.theme');

if (resolved === theme) {
  console.log('resolved registered cell successfully');
}
```

## Notes

- This API is mainly for tooling/integration code that resolves cells by stable id.
- In normal app logic, prefer direct cell references over global id lookup.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
