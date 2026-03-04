# Scheduler

## Kind

- class

## Description

Two-channel update orchestrator (committed + buffered).

## Example

```ts twoslash
import { createStore, cell } from '@suzumiyaaoba/scope-flux-core';
import { Scheduler } from '@suzumiyaaoba/scope-flux-scheduler';

const store = createStore();
const count = cell(0, { id: 'count' });
const scheduler = new Scheduler({ scope: store.scope, autoFlush: 'microtask' });

scheduler.set(count, 1, { priority: 'transition' });
scheduler.getBuffered(count);
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

- [scheduler module index](/api/scheduler)
- [Typedoc root](/typedoc/index.html)
