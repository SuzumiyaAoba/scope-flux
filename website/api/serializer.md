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

## Arguments Reference

### `serialize(scope, opts?)`

- `scope: Scope`
  - Target scope. Values without `get/set` throw `NS_SER_INVALID_SCOPE`.
- `opts?: SerializeOptions`
  - `only?: AnyCell[]`
    - Serializes only specified cells. Defaults to `scope._listKnownCells()`.
  - `maxBytes?: number`
    - UTF-8 byte limit. Exceeding throws `NS_SER_PAYLOAD_TOO_LARGE`.
- Returns: `SerializedScope`

### `hydrate(scope, payload, opts?)`

- `scope: Scope`
- `payload: unknown`
  - Schema-validated payload. Invalid schema throws `NS_SER_INVALID_SCHEMA`.
- `opts?: HydrateOptions`
  - `mode?: 'safe' | 'force'` (default `'safe'`)
- Returns: `void`
  - `safe` does not overwrite already hydrated IDs.
  - `force` overwrites already hydrated IDs.

### `escapeJsonForHtml(json)`

- `json: string`
  - Pass raw JSON string (typically after `JSON.stringify`).
- Returns: `string`
  - Escaped output safe for HTML embedding (`<`, `\u2028`, `\u2029`).

## Literal Union Values

### `HydrateOptions.mode`

- `'safe'`
  - Default mode preventing duplicate application for same hydrated ID.
- `'force'`
  - Reapplies and overwrites even already hydrated IDs.

### `SerializedScope.meta.source` (optional)

- `'ssr'`
  - Payload produced by server rendering.
- `'persist'`
  - Payload loaded from persistence storage.
- `'test'`
  - Payload intended for tests.

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

## Example

```ts
import { cell, createStore } from '@scope-flux/core';
import { serialize, hydrate, escapeJsonForHtml } from '@scope-flux/serializer';

const count = cell(0, { id: 'count' });
const serverScope = createStore().fork();
serverScope.set(count, 42);

const payload = serialize(serverScope);
const safeInlineJson = escapeJsonForHtml(JSON.stringify(payload));
void safeInlineJson;

const clientScope = createStore().fork();
hydrate(clientScope, payload, { mode: 'safe' });
```

## Notes

- Only JSON-compatible values are serializable.
- `safe` hydrate mode is recommended for most SSR/client hydration paths.


## Reading Guide

- Start with this page for concepts and argument intent.
- Open `/api/<module>/functions/*` for operational usage patterns.
- Open `/api/<module>/types/*` for boundary contracts and type-level constraints.

## Production Checklist

- Define stable IDs for states that must be serialized or inspected.
- Attach `reason` metadata for important updates and side effects.
- Prefer explicit flush/hydration boundaries rather than implicit state transitions.
