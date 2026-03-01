# Core API

`@scope-flux/core` is the runtime foundation. It is framework-agnostic and can run in Node or browser environments.

Everything else (`react`, `scheduler`, `serializer`, `inspect`) builds on top of this package.
If you understand core well, the rest of the stack becomes straightforward.

## Mental Model

- `cell`: mutable source of truth.
- `computed`: pure derived value from cells/computed.
- `event`: explicit input signal.
- `effect`: side-effect boundary for async or external I/O.
- `scope`: isolated runtime instance (request-safe, test-safe).

Rule of thumb:

- put data in `cell`
- put derivation in `computed`
- put "something happened" in `event`
- put I/O in `effect`

## Primitives

### `cell<T>(init, options?)`
Use for state that can change over time.

- `init`: initial value
- `options.id`: stable key for serialization/hydration
- `options.serializable`: include/exclude from serialization
- `options.equal`: custom equality to suppress redundant updates

When to use:
- UI state, filters, form data, normalized entities.

Avoid:
- Storing non-serializable objects in cells that must cross SSR/RSC boundaries.

Practical note:

- Give cells explicit ids if state may need hydration or inspection.
- If id duplicates exist, runtime throws an error during cell creation.

### `computed<T>(read, options?)`
Pure derived state. The runtime caches and invalidates based on dependencies.

When to use:
- Derived lists, counters, joined view models.

Avoid:
- Side effects (`fetch`, logging, mutation) inside `read`.

Why purity matters:

- makes caching correct and predictable
- avoids hidden update loops
- keeps behavior testable with plain scope reads

### `event<P>(options?)`
Typed input channel. Events represent intent, not state.

When to use:
- User actions (`submitted`, `itemSelected`, `filterChanged`).

Common pattern:

- `emit(event, payload)` from UI
- register handler with `scope.on(event, handler)` in composition layer
- handler updates cells or runs effects

### `effect<P, R>(handler, options?)`
Async/sync side-effect wrapper. Keep I/O out of pure logic.

When to use:
- API calls, storage I/O, analytics dispatch.

## Store / Scope API

### `createStore({ seed? })`
Creates a root store object. Use `fork()` to get isolated scopes.

`seed` is useful for tests and deterministic startup states.

### `store.fork(seed?)`
Creates an isolated scope.

When to use:
- Per-request SSR scope
- Test isolation
- Feature sandboxing

### `scope.get(unit)`
Reads current value from `cell` or `computed`.

### `scope.set(cell, next, options?)`
Writes to a cell.

- `next` can be value or updater function `(prev) => next`.

### `scope.emit(event, payload, options?)`
Emits event payload to registered handlers.

### `scope.run(effect, payload, options?)`
Executes effect handler with scope context.

### `scope.batch(fn)`
Groups multiple updates into one commit notification.

Use batching when multiple writes represent one logical action.

### `scope.subscribe(listener)`
Subscribes to commit events for observability or integration.

## Update Options

```ts
interface UpdateOptions {
  priority?: 'urgent' | 'transition' | 'idle';
  reason?: string;
}
```

- `priority` influences runtime/scheduler handling.
- `reason` is useful for diagnostics and traces.

Example reasons:

- `"todo.add"`
- `"filters.changed"`
- `"hydrate.initial"`

## Practical Example

```ts
import { cell, computed, createStore } from '@scope-flux/core';

const items = cell<string[]>([], { id: 'items' });
const query = cell('', { id: 'query' });
const filtered = computed([query, items], (q, list) =>
  list.filter((x) => x.toLowerCase().includes(q.toLowerCase()))
);

const scope = createStore().fork();
scope.set(items, ['Apple', 'Banana', 'Orange']);
scope.set(query, 'an');
console.log(scope.get(filtered)); // ['Banana', 'Orange']
```

## Type Inference Preview (Twoslash)

```ts twoslash
type Cell<T> = { kind: 'cell'; value: T };

declare function cell<T>(init: T): Cell<T>;
declare function computed<A, B, R>(
  deps: [Cell<A>, Cell<B>],
  read: (a: A, b: B) => R,
): Cell<R>;

const count = cell(1);
const step = cell(2);
const total = computed([count, step], (c, s) => c + s);
```

## Suggested Project Structure

- `state/units.ts`: `cell`, `computed`, `event`, `effect` definitions
- `state/handlers.ts`: event handlers and effect orchestration
- `state/scope.ts`: store/scope creation
- `ui/*`: React components using read/write hooks

This keeps core logic reusable outside React.

## Common Pitfalls

- Missing `id` on cells that must be hydrated later.
- Side effects in `computed`.
- Using one shared scope for all server requests.
- Updating complex objects in-place instead of returning new immutable values.
