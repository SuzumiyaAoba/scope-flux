# Getting Started

## Installation

```bash
npm install @scope-flux/core @scope-flux/react @scope-flux/scheduler @scope-flux/serializer @scope-flux/inspect
```

## Minimal Example

```ts
import { cell, createStore } from '@scope-flux/core';

const count = cell(0, { id: 'count' });
const store = createStore();
const scope = store.fork();

scope.set(count, 1);
console.log(scope.get(count)); // 1
```

## React Setup

```tsx
import { createStore, cell } from '@scope-flux/core';
import { StoreProvider, useUnit, useCellAction } from '@scope-flux/react';

const count = cell(0, { id: 'count' });
const scope = createStore().fork();

function Counter() {
  const value = useUnit(count);
  const setCount = useCellAction(count);
  return (
    <button onClick={() => setCount((prev) => prev + 1)}>
      {value}
    </button>
  );
}

export function App() {
  return (
    <StoreProvider scope={scope}>
      <Counter />
    </StoreProvider>
  );
}
```

## Duplicate ID Check (Library Development)

When developing `scope-flux` itself, you can statically detect duplicate `cell` ids:

```bash
npm run lint:ids
```
