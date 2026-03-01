# Getting Started

This page helps you get from zero to a working `scope-flux` setup.

At the end, you will understand:

- which packages to install first
- how to define state with `cell`
- how to connect it to React with `StoreProvider`
- where to go next for production features

## Prerequisites

- Node.js 20+ recommended
- TypeScript 5+
- React 18+ (or 19) for `@scope-flux/react`

## Installation

Install all packages if you want the full feature set (core + react + scheduler + serializer + inspect):

```bash
npm install @scope-flux/core @scope-flux/react @scope-flux/scheduler @scope-flux/serializer @scope-flux/inspect
```

If you want to start smaller:

- minimum runtime: `@scope-flux/core`
- React binding only: add `@scope-flux/react`
- SSR transport: add `@scope-flux/serializer`
- tracing/devtools: add `@scope-flux/inspect`

## Minimal Example

Start with pure core runtime first. This keeps the model simple.

```ts
import { cell, createStore } from '@scope-flux/core';

const count = cell(0, { id: 'count' });
const store = createStore();
const scope = store.fork();

scope.set(count, 1);
console.log(scope.get(count)); // 1
```

What this example shows:

- `cell(0, { id: 'count' })`: creates mutable state with a stable identifier.
- `createStore().fork()`: creates an isolated scope instance.
- `scope.set/get`: write and read state from that scope.

Why scope isolation matters:

- tests do not leak state into each other
- SSR requests can use independent state instances
- features can be sandboxed safely

## React Setup

Once core behavior is clear, connect it to React.

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

How it works:

- `StoreProvider` injects the scope into React context.
- `useUnit(count)` reads current value.
- `useCellAction(count)` returns a typed setter function.

Common mistakes:

- using hooks outside `StoreProvider`
- sharing one server-side scope across multiple HTTP requests
- omitting `id` for state that must be serialized/hydrated later

## Duplicate ID Check (Library Development)

When developing `scope-flux` itself, you can statically detect duplicate `cell` ids:

```bash
npm run lint:ids
```

## Where to Go Next

1. [Tutorial: Build a Todo App](/tutorial-todo)
2. [Architecture](/architecture)
3. [Core API](/api/core)
4. [Migration Guides](/migration/)
