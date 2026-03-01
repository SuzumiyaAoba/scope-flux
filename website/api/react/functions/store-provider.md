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

## Example

```tsx
import { createStore, cell } from '@scope-flux/core';
import { StoreProvider, useUnit } from '@scope-flux/react';

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

- Every hook from `@scope-flux/react` must run under `StoreProvider`.
- For SSR, create a fresh scope per request and pass that scope to the provider.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
