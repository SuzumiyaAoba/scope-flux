# createReduxDevtoolsAdapter

## Signature

```ts
createReduxDevtoolsAdapter(options?: ReduxDevtoolsAdapterOptions): ReduxDevtoolsAdapter
```

## Description

Creates Redux DevTools adapter with graceful no-op fallback.

## Parameters

- `options.extension`: explicit extension instance.
- `options.name`: DevTools connection name.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts
import { createReduxDevtoolsAdapter } from '@suzumiyaaoba/scope-flux-inspect';

const adapter = createReduxDevtoolsAdapter({ name: 'scope-flux' });
adapter.init({ count: 0 });
adapter.send(
  { type: 'counter.increment', reason: 'button.click' },
  { count: 1 },
);
```

## Notes

- Use this adapter when you want inspect traces visible in Redux DevTools-compatible UI.
- If extension is unavailable, adapter methods become no-op and app behavior stays stable.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [inspect module index](/api/inspect)
- [inspect module guide](/api/inspect)
- [Typedoc root](/typedoc/index.html)
