# Scheduler API

`@suzumiyaaoba/scope-flux-scheduler` provides two-layer update handling:

- committed path (authoritative)
- buffered path (transition/idle UI updates)

Use this package when interaction performance matters.
If your app is simple, you can stay on urgent updates only and skip scheduler-specific patterns.

## Creation

```ts
import { createScheduler } from '@suzumiyaaoba/scope-flux-scheduler';

const scheduler = createScheduler({ scope });
```

Auto flush is optional:

```ts
const scheduler = createScheduler({
  scope,
  autoFlush: 'microtask',
});
```

## Priority Typing Preview (Twoslash)

```ts twoslash
type Priority = 'urgent' | 'transition' | 'idle';
type Cell<T> = { value: T };
type Update<T> = T | ((prev: T) => T);

declare function set<T>(cell: Cell<T>, next: Update<T>, options: { priority: Priority }): void;

const query = {} as Cell<string>;
set(query, 'a', { priority: 'transition' });
set(query, (prev) => prev + 'b', { priority: 'idle' });
```

## Methods and Behavior

### `scheduler.set(cell, next, { priority })`
- `urgent`: direct commit to scope.
- `transition`/`idle`: buffered only.

`transition` and `idle` do not immediately mutate committed state.
They stage updates in buffered channel until flush.

### `scheduler.getBuffered(cell)`
Returns buffered value if exists; otherwise committed value.

### `scheduler.getCommitted(cell)`
Reads authoritative committed value from scope.

### `scheduler.getPendingBufferedUpdates()`
Returns current pending buffered updates.

### `scheduler.flushBuffered({ reason? })`
Commits buffered updates in one batch and clears buffer.

This is the commit boundary for transition/idle writes.

### `scheduler.dropBuffered()`
Clears buffered updates without committing.

### `scheduler.subscribeBuffered(listener)`
Subscribes to buffered-state changes.

### `options.autoFlush`

- `false` (default): explicit `flushBuffered` only.
- `'microtask'`: flush in next microtask.
- `'timeout'`: flush by `setTimeout(autoFlushDelayMs)`.
- `'animationFrame'`: flush in next RAF tick (fallback to timeout).
- `'idle'`: flush via `requestIdleCallback` (fallback to timeout).

## Arguments Reference

### `createScheduler(options)`

- `options: { scope: Scope; autoFlush?: false | 'microtask' | 'timeout' | 'animationFrame' | 'idle'; autoFlushDelayMs?: number }`
  - Returns a scheduler bound to the given scope.

### `scheduler.set(cell, next, options?)`

- `cell: AnyCell`
  - Target cell.
- `next: T | ((prev: T) => T)`
  - Direct value or updater.
- `options?: UpdateOptions`
  - `priority?: Priority` (default `'urgent'`)
  - `reason?: string`

### `scheduler.getBuffered(cell)`

- `cell: AnyCell`
  - Returns buffered value when present; otherwise committed value.

### `scheduler.getCommitted(cell)`

- `cell: AnyCell`
  - Returns authoritative committed scope state.

### `scheduler.getPendingBufferedUpdates()`

- No arguments.
- Returns: `PendingBufferedUpdate[]`
  - `{ cell, value, priority, reason? }`

### `scheduler.flushBuffered(options?)`

- `options?: { reason?: string }`
  - When provided, overrides reason for all flushed updates.
  - Otherwise uses each pending update reason; falls back to `'scheduler.flushBuffered'`.

### `scheduler.dropBuffered()`

- No arguments.
  - Drops buffered, uncommitted updates.

### `scheduler.subscribeBuffered(listener)`

- `listener: () => void`
  - Called when buffered state changes.
- Returns: `() => void`
  - Unsubscribe function.

## Literal Union Values

### `Priority`

- `'urgent'`
  - Writes directly via `scope.set`.
- `'transition'`
  - Writes to buffer and waits for `flushBuffered`.
- `'idle'`
  - Same buffered behavior as `'transition'`, but with lower-priority intent.

### `PendingBufferedUpdate.priority`

- Possible values are only `'transition' | 'idle'` (`'urgent'` never becomes pending).

## Design Notes

- Repeated buffered updates for the same cell are coalesced.
- Urgent updates are never blocked by buffered queue.
- Flush happens in a single scope batch to keep commit stream coherent.

## Typical Use

- Expensive view-model updates while typing.
- Smooth UI interaction with deferred authoritative commit.

## When Not to Use Buffered Updates

- critical data that must be immediately authoritative
- security/permission state
- side effects that depend on immediate persistence

In these cases, keep updates `urgent`.

## Example

```ts twoslash
import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import { createScheduler } from '@suzumiyaaoba/scope-flux-scheduler';

const scope = createStore().fork();
const scheduler = createScheduler({ scope });
const query = cell('', { id: 'query' });

scheduler.set(query, 'sc', { priority: 'transition', reason: 'input.typing' });
console.log(scheduler.getBuffered(query)); // "sc"
console.log(scheduler.getCommitted(query)); // ""

scheduler.flushBuffered({ reason: 'input.blur' });
console.log(scheduler.getCommitted(query)); // "sc"
```

## Notes

- `transition` and `idle` are staged updates; they require `flushBuffered` to commit.
- Use `dropBuffered` when temporary changes should be discarded.


## Reading Guide

- Start with this page for concepts and argument intent.
- Open `/api/<module>/functions/*` for operational usage patterns.
- Open `/api/<module>/types/*` for boundary contracts and type-level constraints.

## Production Checklist

- Define stable IDs for states that must be serialized or inspected.
- Attach `reason` metadata for important updates and side effects.
- Prefer explicit flush/hydration boundaries rather than implicit state transitions.
