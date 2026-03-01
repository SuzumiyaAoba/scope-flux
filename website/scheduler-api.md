# Scheduler API

`@scope-flux/scheduler` provides two-layer update handling:

- committed path (authoritative)
- buffered path (transition/idle UI updates)

Use this package when interaction performance matters.
If your app is simple, you can stay on urgent updates only and skip scheduler-specific patterns.

## Creation

```ts
import { createScheduler } from '@scope-flux/scheduler';

const scheduler = createScheduler({ scope });
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
