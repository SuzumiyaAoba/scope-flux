# createStore

## Signature

```ts
createStore(options?: { seed?: SeedInput }): Store
```

## Description

Creates a store with a root scope and forking API.

## Parameters

- `options.seed`: initial seed values for root scope.

## Example

```ts
import { createStore, cell } from '@scope-flux/core';

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

## Related

- [core module index](/api/core)
- [core module guide](/api/core)
- [Typedoc root](/typedoc/index.html)
