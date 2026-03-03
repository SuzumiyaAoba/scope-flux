# StoreProvider

## Signature

```ts
StoreProvider(props: StoreProviderProps): React.JSX.Element
```

## Description

Provides scope/scheduler context to React subtree.

## Parameters

- `scope`: target scope.
- `scheduler`: optional scheduler (auto-created if omitted).
- `children`: subtree using hooks.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { createStore, cell } from '@suzumiyaaoba/scope-flux-core';
import { StoreProvider, useUnit } from '@suzumiyaaoba/scope-flux-react';

const scope = createStore().fork();
const count = cell(1, { id: 'counter.count' });

function CounterLabel() {
  const value = useUnit(count);
  return <p>count: {value}</p>;
}

export function App() {
  return (
    <StoreProvider scope={scope}>
      <CounterLabel />
    </StoreProvider>
  );
}
```

## Notes

- Every hook from `@suzumiyaaoba/scope-flux-react` must run under `StoreProvider`.
- For SSR, create a fresh scope per request and pass that scope to the provider.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
