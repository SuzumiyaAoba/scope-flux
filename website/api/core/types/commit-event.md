# CommitEvent

## Kind

- interface

## Description

Commit envelope emitted to subscribers.

## Example

```ts twoslash
import { cell, type CommitEvent } from '@suzumiyaaoba/scope-flux-core';

const count = cell(0, { id: 'count' });

const evt: CommitEvent = {
  type: 'commit',
  priority: 'urgent',
  changes: [{ kind: 'set', unit: count, prev: 0, next: 1 }],
};
evt.changes.length;
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

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
