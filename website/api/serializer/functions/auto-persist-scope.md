# autoPersistScope

## Signature

```ts
autoPersistScope(
  scope: Scope,
  key: string,
  options?: AutoPersistOptions
): { unsubscribe: () => void; flush: () => SerializedScope | null }
```

## Description

Subscribes to scope commits and persists payloads automatically.

This helper is useful for app-level persistence wiring without manually subscribing and serializing on every commit.

## Parameters

- `scope`: target scope.
- `key`: storage key.
- `options.debounceMs`: debounce delay before write.
- `options.throttleMs`: minimum interval between writes.
- `options.onError`: callback for persistence errors.
- `options.storage`: custom storage adapter.

## Example

```ts twoslash
import { autoPersistScope } from '@suzumiyaaoba/scope-flux-serializer';

const persistence = autoPersistScope(scope, 'scope-flux:app', {
  debounceMs: 100,
  onError: (error) => console.error('persist failed', error),
});

// force immediate save
persistence.flush();
// stop auto persistence
persistence.unsubscribe();
```

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
