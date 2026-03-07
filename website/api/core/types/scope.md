# Scope

## Kind

- class

## Description

Runtime boundary holding cell values, computed cache, subscriptions, and event handlers.

Notable runtime methods include:

- `get(unit)` / `set(cell, next, options?)`
- `reset(cell, options?)` — restore cell to initial value
- `batch(fn)` — group updates into one commit
- `run(effect, payload, options?)` / `cancelEffect(effect)` / `getEffectStatus(effect)`
- `subscribeUnit(unit, listener)` / `subscribe(listener)` / `subscribeEffectStatus(effect, listener)`
- `destroy()` — release all subscriptions, cancel effects, clear state
- `fork(seed?)` — create child scope with inherited state

## Example

```ts twoslash
import { createStore, type Scope } from '@suzumiyaaoba/scope-flux-core';

const store = createStore();
const scope: Scope = store.scope;
scope.id;
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
