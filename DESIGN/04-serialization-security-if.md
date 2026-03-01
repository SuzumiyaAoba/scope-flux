# Serialization and Security Interface

## Payload Shape

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface SerializedScope {
  version: number;
  scopeId: string;
  values: Record<StableId, JsonValue>;
  meta?: {
    createdAt?: string;
    source?: 'ssr' | 'persist' | 'test';
  };
}
```

## API

```ts
export interface SerializeOptions {
  only?: Array<Cell<unknown>>;
  includeNonSerializable?: false;
  maxBytes?: number;
}

export interface HydrateOptions {
  mode?: 'safe' | 'force';
  merge?: 'preserve-existing' | 'replace';
  validateSchema?: boolean;
}

export function serialize(scope: Scope, opts?: SerializeOptions): SerializedScope;

export function hydrate(
  scope: Scope,
  payload: SerializedScope,
  opts?: HydrateOptions
): void;

export function escapeJsonForHtml(json: string): string;
```

## Security Rules

- Serialization allows JSON-safe values only.
- Hydration payload is always treated as untrusted input.
- Validation pipeline:
  1. size limit check
  2. structure/schema validation
  3. stable-id allowlist check
  4. value type check
  5. merge policy application

## Hydration Semantics

- Default mode (`safe`) is idempotent:
  - existing hydrated IDs are not overwritten.
- `force` mode allows overwrite but emits warning callback.
- Unknown IDs are ignored by default, optionally reported via diagnostics.

## Error Codes (Draft)

- `NS_SER_NON_JSON_VALUE`
- `NS_SER_PAYLOAD_TOO_LARGE`
- `NS_SER_INVALID_SCHEMA`
- `NS_SER_UNKNOWN_STABLE_ID`
- `NS_SER_FORCE_HYDRATE_REQUIRED`
