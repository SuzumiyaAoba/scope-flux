# SerializedScope

## Kind

- interface

## Description

Transport payload structure for serialized scope.

## Example

```ts twoslash
import type { SerializedScope } from '@suzumiyaaoba/scope-flux-serializer';

const payload: SerializedScope = {
  version: 1,
  scopeId: 'scope-1',
  values: {
    count: 1,
    userName: 'alice',
  },
  meta: {
    source: 'persist',
    createdAt: new Date().toISOString(),
  },
};
payload.values.count;
//^?
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
