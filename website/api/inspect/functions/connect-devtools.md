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
  - if adapter has `subscribe`, `jump_to_state` and `import_state` are applied to scope.
- `options.trace`: optional trace relation flag.
- `options.onError`: optional error callback for `init` / `send` / `receive`.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

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
- Imported snapshots apply only to registered stable IDs.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [inspect module index](/api/inspect)
- [inspect module guide](/api/inspect)
- [Typedoc root](/typedoc/index.html)
