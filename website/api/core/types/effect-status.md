# EffectStatus<R>

## Kind

- interface

## Description

Runtime status snapshot for an effect returned by `scope.getEffectStatus(effect)`.

Fields:

- `running: number`
- `queued: number`
- `lastError?: unknown`
- `lastResult?: R`
- `lastStartedAt?: number`
- `lastFinishedAt?: number`

## Example

```ts twoslash
import { createStore, effect } from '@suzumiyaaoba/scope-flux-core';

const scope = createStore().fork();
const fx = effect(async () => 1);

await scope.run(fx, undefined);
const status = scope.getEffectStatus(fx);
console.log(status.lastResult); // 1
```

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
