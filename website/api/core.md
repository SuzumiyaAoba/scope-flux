# Core API

`@suzumiyaaoba/scope-flux-core` is the runtime foundation. It is framework-agnostic and can run in Node or browser environments.

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

Effect options also support execution policy:

- `concurrency`: `'parallel' | 'drop' | 'replace' | 'queue'`
- `retries`: retry count for failures
- `retryDelayMs`: retry backoff delay

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

- supports `signal`, `timeoutMs`, `retries`
- respects `effect` policy (`drop`/`replace`/`queue`)

### `scope.batch(fn)`
Groups multiple updates into one commit notification.

Use batching when multiple writes represent one logical action.

### `scope.subscribe(listener)`
Subscribes to commit events for observability or integration.

### `scope.subscribeUnit(unit, listener)`
Subscribes to updates of a specific unit.

- `cell`: notified on updates to the target cell.
- `computed`: falls back to scope commit subscription.

### `scope.cancelEffect(effect)`
Aborts running and queued executions for the target effect.

### `scope.getEffectStatus(effect)`
Returns runtime status (`running`, `queued`, `lastError`, `lastResult`, timestamps).

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

## Arguments Reference

### `cell<T>(init, options?)`

- `init: T`
  - Initial value of the cell.
- `options?: UnitMeta & { equal?: (a: T, b: T) => boolean }`
  - `id?: string`
    - Stable ID used by serializer/hydration/inspect.
    - Throws `NS_CORE_DUPLICATE_STABLE_ID:<id>` when duplicated.
  - `debugName?: string`
    - Human-readable debug label.
  - `serializable?: boolean`
    - If `false`, excluded from serializer output.
  - `equal?: (a, b) => boolean`
    - Custom equality check. If it returns `true`, update is skipped.

### `computed(deps, read, options?)`

- `deps: readonly (Cell<any> | Computed<any>)[]`
  - Dependency unit list. Values are passed to `read` in the same order.
- `read: (...args) => T`
  - Pure derivation function. It should not perform side effects.
- `options?: { debugName?: string; cache?: 'scope' | 'none' }`
  - `cache`
    - `'scope'`: Returns cached value until dependency versions change (default).
    - `'none'`: Recomputes on every read.

### `event<P>(options?)`

- `options?: { debugName?: string }`
  - Sets a debug label.

### `effect<P, R>(handler, options?)`

- `handler: (payload: P, ctx: { scope: Scope; signal: AbortSignal; attempt: number }) => Promise<R> | R`
  - Effect implementation. You can mutate state via `ctx.scope`.
  - Throws `NS_CORE_MISSING_HANDLER` when missing/invalid.
- `options?: { debugName?: string; policy?: EffectPolicy }`
  - Sets a debug label.
  - `policy?.concurrency?: 'parallel' | 'drop' | 'replace' | 'queue'`
  - `policy?.retries?: number`
  - `policy?.retryDelayMs?: number | ((attempt, error) => number)`

### `createStore(options?)`

- `options?: { seed?: SeedInput }`
  - `seed` injects initial cell values.
  - `SeedInput` is `Map<Cell, unknown>` or `Array<[Cell, unknown]>`.

### `scope.get(unit)`

- `unit: Cell<T> | Computed<T>`
  - Returns cell value or computed value.
  - Throws `NS_CORE_INVALID_UPDATE` for invalid units.

### `scope.set(unit, next, options?)`

- `unit: Cell<T>`
  - Target cell to update.
- `next: T | ((prev: T) => T)`
  - Direct value or updater function.
- `options?: UpdateOptions`
  - `priority?: Priority`
  - `reason?: string`

### `scope.on(event, handler)`

- `event: Event<P>`
  - Event to subscribe to.
- `handler: (payload: P, scope: Scope, options: UpdateOptions) => void`
  - Callback invoked on emit.
- Returns: `Unsubscribe`
  - Unsubscribe function.

### `scope.emit(event, payload, options?)`

- `event: Event<P>`
- `payload: P`
- `options?: UpdateOptions`

### `scope.run(effect, payload, options?)`

- `effect: Effect<P, R>`
  - Effect to execute. Invalid value throws `NS_CORE_INVALID_UPDATE`.
- `payload: P`
- `options?: RunOptions`
  - `priority?: Priority`
  - `reason?: string`
  - `signal?: AbortSignal`
  - `timeoutMs?: number`
  - `retries?: number`
- Returns: `Promise<R>`

### `scope.subscribeUnit(unit, listener)`

- `unit: Cell<T> | Computed<T>`
- `listener: () => void`
- Returns: `Unsubscribe`

### `scope.cancelEffect(effect)`

- `effect: Effect<P, R>`
- Returns: `void`

### `scope.getEffectStatus(effect)`

- `effect: Effect<P, R>`
- Returns: `EffectStatus<R>`
  - `running: number`
  - `queued: number`
  - `lastError?: unknown`
  - `lastResult?: R`

### `scope.batch(fn)`

- `fn: () => T`

## Example

```ts twoslash
import { createStore, cell, computed } from '@suzumiyaaoba/scope-flux-core';

const count = cell(0, { id: 'count' });
const doubled = computed([count], (n) => n * 2);
const scope = createStore().fork();

scope.batch(() => {
  scope.set(count, 1, { reason: 'counter.increment' });
});

console.log(scope.get(doubled)); // 2
```

## Notes

- Prefer explicit `id` and `reason` values for debugging and serialization.
- Keep `computed` functions pure and move side effects to `effect`.
  - Groups updates into a single commit.

### `scope.subscribe(listener)`

- `listener: (evt: CommitEvent) => void`
  - Called for each commit.
- Returns: `Unsubscribe`

### `store.fork(seed?)`

- `seed?: SeedInput`
  - Initial values for the new `Scope`.

### `getRegisteredCellById(id)`

- `id: string`
  - Looks up a cell registered via `cell({ id })`.

### `listRegisteredCells()`

- No arguments.
  - Returns all registered cells.

## Literal Union Values

### `Priority`

- `'urgent'`
  - Immediate commit.
- `'transition'`
  - Transition priority (buffered when going through scheduler).
- `'idle'`
  - Low-priority update (buffered when going through scheduler).

### `computed.options.cache`

- `'scope'`
  - Uses dependency-version-based cache.
- `'none'`
  - Recomputes every time.

## Practical Example

```ts
import { cell, computed, createStore } from '@suzumiyaaoba/scope-flux-core';

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


## Reading Guide

- Start with this page for concepts and argument intent.
- Open `/api/<module>/functions/*` for operational usage patterns.
- Open `/api/<module>/types/*` for boundary contracts and type-level constraints.

## Production Checklist

- Define stable IDs for states that must be serialized or inspected.
- Attach `reason` metadata for important updates and side effects.
- Prefer explicit flush/hydration boundaries rather than implicit state transitions.
