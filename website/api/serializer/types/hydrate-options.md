# HydrateOptions

## Kind

- interface

## Description

Options for `hydrate` including mode literal union.

## Literal Union Values

- `mode: "safe"`: default; skip already hydrated IDs.
- `mode: "force"`: overwrite already hydrated IDs.

## Example

```ts
import type { HydrateOptions } from '@scope-flux/serializer';

const options: HydrateOptions = { mode: 'safe' };
void options;
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
