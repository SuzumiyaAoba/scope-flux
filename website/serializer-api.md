# Serializer API

`@scope-flux/serializer` handles safe state transport between runtimes (SSR/RSC/client).

This package is about deterministic transport, not generic object dumping.
It intentionally limits values to JSON domain for safety and portability.

## Core Types

### `JsonValue`
Allowed serialized value domain:
- `null | boolean | number | string | JsonValue[] | Record<string, JsonValue>`

```ts twoslash
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type SerializedScope = {
  version: number;
  scopeId: string;
  values: Record<string, JsonValue>;
};

const payload: SerializedScope = {
  version: 1,
  scopeId: 'app',
  values: { count: 1, profile: { name: 'Aoba' } },
};
```

### `SerializedScope`
Transport payload:

```ts
{
  version: number;
  scopeId: string;
  values: Record<string, JsonValue>;
}
```

`version` allows future format evolution.
`scopeId` helps diagnostics, while `values` is the actual state map by stable cell id.

## Methods

### `serialize(scope, { only?, maxBytes? })`
Creates payload from scope.

- Cells without `id` are skipped.
- `serializable: false` cells are skipped.
- Non-JSON values throw `NS_SER_NON_JSON_VALUE`.
- Payload size can be capped.

`only` is useful when you want partial payloads (for example, public state only).

### `hydrate(scope, payload, { mode? })`
Applies payload to scope.

- Payload is validated as untrusted input.
- Unknown IDs are ignored.
- Invalid schema throws `NS_SER_INVALID_SCHEMA`.

Ignoring unknown ids helps forward/backward compatibility between server/client builds.

### `escapeJsonForHtml(json)`
Escapes JSON for safe HTML script embedding (`<`, `\u2028`, `\u2029`).

Always escape before embedding JSON into HTML to avoid accidental script breakouts.

## Hydrate Modes

- `safe` (default)
  - idempotent for already hydrated IDs
- `force`
  - overwrites previously hydrated IDs

## Recommended SSR Flow

1. Server: `serialize(scope)`
2. Server HTML embed: `escapeJsonForHtml(JSON.stringify(payload))`
3. Client: `hydrate(clientScope, payload, { mode: 'safe' })`

## Local Persistence Flow (Client Only)

1. App startup: read localStorage payload, hydrate with `safe`.
2. On scope updates: `serialize(scope)` and write back to localStorage.
3. Keep payload small and avoid storing sensitive data.

## Common Pitfalls

- Forgetting `id` on cells that must be transported.
- Using `force` by default in interactive pages.
- Serializing sensitive data without explicit filtering.
- Assuming functions/classes/Date objects can be safely serialized as-is.
