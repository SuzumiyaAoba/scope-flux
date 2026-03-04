# createStore

## Signature

```ts
createStore(options?: { seed?: SeedInput }): Store
```

## Description

Creates a store with a root scope and forking API.

## Parameters

- `options.seed`: initial seed values for root scope.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts twoslash
import { createStore, cell } from '@suzumiyaaoba/scope-flux-core';

const userId = cell<string | null>(null, { id: 'session.userId' });
const store = createStore();

const requestScope = store.fork();
requestScope.set(userId, 'u_42', { reason: 'auth.login' });

const testScope = store.fork();
console.log(testScope.get(userId)); // null (isolated from requestScope)
```

## Notes

- Create one store root and fork scopes per request/test to isolate state.
- Seeded store creation is useful for deterministic test and SSR bootstrap flows.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
