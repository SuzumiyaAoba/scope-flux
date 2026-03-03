# RunOptions

## Kind

- interface

## Description

Execution options for `scope.run(effect, payload, options?)`.

Main fields:

- `priority?: 'urgent' | 'transition' | 'idle'`
- `reason?: string`
- `signal?: AbortSignal`
- `timeoutMs?: number`
- `retries?: number`

## Example

```ts
import { createStore, effect } from '@scope-flux/core';

const scope = createStore().fork();
const fx = effect(async (_: void) => 1);

await scope.run(fx, undefined, {
  reason: 'load.initial',
  timeoutMs: 3000,
  retries: 1,
});
```

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
