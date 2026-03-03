# serialize

## Signature

```ts
serialize(scope: Scope, opts?: SerializeOptions): SerializedScope
```

## Description

Serializes scope state to safe JSON payload.

## Parameters

- `scope`: target scope.
- `opts.only`: optional target cell list.
- `opts.maxBytes`: max UTF-8 payload bytes.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts
import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import { serialize } from '@suzumiyaaoba/scope-flux-serializer';

const count = cell(1, { id: 'counter.count' });
const ephemeral = cell(new Map(), { id: 'tmp.map', serializable: false });

const scope = createStore().fork();
scope.set(count, 7);
scope.set(ephemeral, new Map([['k', 'v']]));

const payload = serialize(scope);
console.log(payload.values); // { 'counter.count': 7 }
```

## Notes

- Only cells with stable id and JSON-serializable values are included in payload.
- Use `only` and `maxBytes` when you need strict control over payload scope and size.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
