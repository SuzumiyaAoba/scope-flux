# hydrate

## Signature

```ts
hydrate(scope: Scope, payload: unknown, opts?: HydrateOptions): void
```

## Description

Validates and applies serialized payload into scope.

## Parameters

- `scope`: target scope.
- `payload`: untrusted serialized input.
- `opts.mode`: hydration mode.
- `opts.migrate`: migration hook for legacy payload versions.


## Literal Union Values

- `mode = "safe"`: skip IDs already hydrated in this scope (default).
- `mode = "force"`: overwrite already hydrated IDs.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts twoslash
import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import { hydrate } from '@suzumiyaaoba/scope-flux-serializer';

const count = cell(0, { id: 'counter.count' });
const scope = createStore().fork();

hydrate(
  scope,
  {
    version: 1,
    scopeId: 'app',
    values: { 'counter.count': 3 },
  },
  { mode: 'safe' },
);

console.log(scope.get(count)); // 3
```

## Notes

- Use `mode: 'safe'` for standard SSR/client hydration to avoid accidental duplicate overwrites.
- Treat incoming payload as untrusted input and validate through serializer schema rules.
- If payload schema version changes, provide `migrate` and return `version: 1`.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
