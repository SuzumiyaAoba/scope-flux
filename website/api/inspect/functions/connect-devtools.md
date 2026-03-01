# connectDevtools

## Signature

```ts
connectDevtools(options: ConnectDevtoolsOptions): Unsubscribe
```

## Description

Bridges inspect records to DevTools-style adapter.

## Parameters

- `options.scope`: target scope.
- `options.adapter`: adapter implementing `init`/`send`.
- `options.trace`: optional trace relation flag.

## Example

```ts
import { createStore } from '@scope-flux/core';
import { connectDevtools, createReduxDevtoolsAdapter } from '@scope-flux/inspect';

const scope = createStore().fork();
const adapter = createReduxDevtoolsAdapter({ name: 'scope-flux-app' });

const stop = connectDevtools({
  scope,
  adapter,
  trace: true,
});

// Call stop() on teardown (tests, HMR dispose, app shutdown).
stop();
```

## Notes

- Connect devtools once during bootstrap and dispose observers on teardown.
- `trace: true` is useful when you need parent-child relation in commit traces.

## Related

- [inspect module index](/api/inspect)
- [inspect module guide](/api/inspect)
- [Typedoc root](/typedoc/index.html)
