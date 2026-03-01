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

## Example

```ts
import { cell, createStore } from '@scope-flux/core';
import { serialize } from '@scope-flux/serializer';

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

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
