# HydrateOptions

## Kind

- interface

## Description

Options for `hydrate` including mode literal union.

Also supports:

- `migrate?: (payload: SerializedScope) => SerializedScope`
  - Use when incoming payload version is not `1`.

## Literal Union Values

- `mode: "safe"`: default; skip already hydrated IDs.
- `mode: "force"`: overwrite already hydrated IDs.

## Example

```ts
import type { HydrateOptions } from '@suzumiyaaoba/scope-flux-serializer';

const options: HydrateOptions = { mode: 'safe' };
void options;
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Where This Type Is Used

- Appears in public API signatures and composition boundaries for this module.
- Useful for app-level contracts, shared utility wrappers, and test helpers.

## Design Guidance

- Keep this type at API boundaries; avoid over-coupling internal business logic to tooling types.
- If you need runtime semantics, pair this page with the corresponding function docs.

## Review Checklist

- Is the type used at module boundaries where type safety matters most?
- Are literal unions handled exhaustively in your code (`switch`/guards)?
- Is the type aligned with serialization and observability constraints?

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
