# SchedulerOptions

## Kind

- interface

## Description

Construction options for Scheduler.

Fields:

- `scope: Scope`
- `autoFlush?: false | 'microtask' | 'timeout' | 'animationFrame' | 'idle'`
- `autoFlushDelayMs?: number`

## Example

```ts
import type { SchedulerOptions } from '@suzumiyaaoba/scope-flux-scheduler';

// Use this type in your app-level contracts
type Example = SchedulerOptions;
void (null as unknown as Example);
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
