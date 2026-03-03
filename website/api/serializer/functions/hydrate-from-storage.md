# hydrateFromStorage

## Signature

```ts
hydrateFromStorage(scope: Scope, key: string, options?: HydrateFromStorageOptions): SerializedScope | null
```

## Description

Loads serialized payload from storage and hydrates scope.

Returns `null` when the key does not exist.

## Parameters

- `scope`: target scope.
- `key`: storage key.
- `options.mode`: hydration mode (`safe`/`force`).
- `options.migrate`: migration hook for legacy versions.
- `options.storage`: custom storage adapter.

## Example

```ts
import { hydrateFromStorage } from '@scope-flux/serializer';

hydrateFromStorage(scope, 'scope-flux:app', { mode: 'safe' });
```

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
