# ComputedArgs<D>

## Kind

- type

## Description

Argument tuple inferred from computed dependencies.

## Example

```ts twoslash
import { cell, computed, type ComputedArgs } from '@suzumiyaaoba/scope-flux-core';

const count = cell(1, { id: 'count' });
const step = cell(2, { id: 'step' });
const sum = computed([count, step] as const, (a, b) => a + b, { id: 'sum' });

type Deps = typeof sum.deps;
const args: ComputedArgs<Deps> = [1, 2];
args;
// ^? [number, number]
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
