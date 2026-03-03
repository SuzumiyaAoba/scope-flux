# persistToStorage

## Signature

```ts
persistToStorage(scope: Scope, key: string, options?: PersistToStorageOptions): SerializedScope
```

## Description

Serializes scope and saves the payload into storage.

Default storage is `localStorage` when available.

## Parameters

- `scope`: target scope.
- `key`: storage key.
- `options.only`: optional cell subset.
- `options.maxBytes`: payload byte limit.
- `options.storage`: custom storage adapter (`getItem`/`setItem`).

## Example

```ts
import { persistToStorage } from '@suzumiyaaoba/scope-flux-serializer';

persistToStorage(scope, 'scope-flux:app');
```

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
