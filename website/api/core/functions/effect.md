# effect

## Signature

```ts
effect<P, R>(handler: (payload: P, ctx: EffectContext) => Promise<R> | R, options?: { debugName?: string }): Effect<P, R>
```

## Description

Creates a side-effect unit.

## Parameters

- `handler`: effect implementation.
- `options.debugName`: debug label.

## Example

```ts
import { effect, cell, createStore } from '@scope-flux/core';

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

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
