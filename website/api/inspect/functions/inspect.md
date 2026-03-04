# inspect

## Signature

```ts
inspect(options: InspectOptions): Unsubscribe
```

## Description

Subscribes to commit stream and emits normalized records.

## Parameters

- `options.scope`: target scope.
- `options.trace`: include parent commit relation.
- `options.sampleRate`: 0..1 sampling ratio.
- `options.onRecord`: record callback.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts twoslash
import { createStore, cell } from '@suzumiyaaoba/scope-flux-core';
import { inspect } from '@suzumiyaaoba/scope-flux-inspect';

const count = cell(0, { id: 'count' });
const scope = createStore().fork();

const stop = inspect({
  scope,
  trace: true,
  sampleRate: 1,
  onRecord: (record) => console.log(record.trace.kind),
});

scope.set(count, 1);
stop();
```

## Notes

- Use this snippet as a starting point and replace IDs/reasons with your domain language.
- Combine this API with the module guide patterns to build end-to-end flows.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [inspect module index](/api/inspect)
- [inspect module guide](/api/inspect)
- [Typedoc root](/typedoc/index.html)
