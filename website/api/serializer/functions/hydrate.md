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


## Literal Union Values

- `mode = "safe"`: skip IDs already hydrated in this scope (default).
- `mode = "force"`: overwrite already hydrated IDs.

## Example

```ts
import { cell, createStore } from '@scope-flux/core';
import { hydrate } from '@scope-flux/serializer';

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

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
