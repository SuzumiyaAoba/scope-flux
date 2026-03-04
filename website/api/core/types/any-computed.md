# AnyComputed

## Kind

- type

## Description

Computed<any, ComputedDeps> shortcut alias.

## Example

```ts twoslash
import { cell, computed, type AnyComputed } from '@suzumiyaaoba/scope-flux-core';

const count = cell(1, { id: 'count' });
const doubled = computed([count] as const, (n) => n * 2, { id: 'doubled' });
const anyComputed: AnyComputed = doubled;
anyComputed.kind;
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
