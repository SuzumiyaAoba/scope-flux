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

## Example

```ts
import { createReduxDevtoolsAdapter } from '@scope-flux/inspect';

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

## Related

- [inspect module index](/api/inspect)
- [inspect module guide](/api/inspect)
- [Typedoc root](/typedoc/index.html)
