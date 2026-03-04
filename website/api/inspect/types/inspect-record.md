# InspectRecord

## Kind

- interface

## Description

Record object passed to `onRecord`.

## Example

```ts twoslash
import type { InspectRecord } from '@suzumiyaaoba/scope-flux-inspect';

const record: InspectRecord = {
  trace: {
    id: 'trace-1',
    ts: Date.now(),
    scopeId: 'scope-1',
    kind: 'event',
  },
  diffs: [],
};
record.diffs;
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

- [inspect module index](/api/inspect)
- [Typedoc root](/typedoc/index.html)
