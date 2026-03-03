# effect

## Signature

```ts
effect<P, R>(
  handler: (payload: P, ctx: EffectContext) => Promise<R> | R,
  options?: { debugName?: string; policy?: EffectPolicy }
): Effect<P, R>
```

## Description

Creates a side-effect unit.

## Parameters

- `handler`: effect implementation.
  - `ctx.scope`: current scope.
  - `ctx.signal`: abort signal for cancellation/replace/timeout.
  - `ctx.attempt`: 1-based attempt index (retry aware).
- `options.debugName`: debug label.
- `options.policy`: execution policy.
  - `concurrency`: `'parallel' | 'drop' | 'replace' | 'queue'`
  - `retries`: retry count.
  - `retryDelayMs`: retry delay or delay factory.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts
import { effect, cell, createStore } from '@suzumiyaaoba/scope-flux-core';

const user = cell<{ id: string; name: string } | null>(null, { id: 'user.current' });

const fetchUser = effect(async (id: string) => {
  return { id, name: 'Aoba' };
});

const scope = createStore().fork();
const loaded = await scope.run(fetchUser, 'u_1', { reason: 'profile.open' });
scope.set(user, loaded, { reason: 'profile.loaded' });
```

## Notes

- Put I/O boundaries in `effect`, then write effect results into cells.
- Pass explicit `reason` values for better traceability in inspect/devtools.
- Use `ctx.signal` in fetch/async calls for cooperative cancellation.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
