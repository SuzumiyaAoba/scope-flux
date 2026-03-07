# createHistoryController

## Signature

```ts
createHistoryController(scope: Scope, options?: HistoryOptions): HistoryController
```

## Description

Creates an undo/redo history controller that tracks cell changes on the given scope.

## Parameters

- `scope`: the scope to observe.
- `options.limit`: maximum number of undo entries (default `100`).
- `options.track`: if provided, only track changes to the listed cells.
- `options.reasonPrefix`: prefix for undo/redo commit reasons (default `'history'`).

## Return Value

A `HistoryController` with the following methods:

- `undo()`: reverts the last change; returns `true` if successful.
- `redo()`: re-applies the last undone change; returns `true` if successful.
- `clear()`: clears both undo and redo stacks.
- `canUndo()` / `canRedo()`: check if operations are available.
- `getSize()`: returns `{ undo: number; redo: number }`.
- `unsubscribe()`: stops tracking.

## Example

```ts
import { cell, createStore, createHistoryController } from '@suzumiyaaoba/scope-flux-core';

const count = cell(0, { id: 'history.count' });
const scope = createStore().fork();
const history = createHistoryController(scope, { limit: 50 });

scope.set(count, 1);
scope.set(count, 2);

history.undo(); // count → 1
history.undo(); // count → 0
history.redo(); // count → 1

history.unsubscribe();
```

## Notes

- Changes made by undo/redo themselves are not recorded in history.
- Multiple cell changes in a single `batch` are collapsed into one history entry.

## Related

- [HistoryController type](/api/core/types/history-controller)
- [HistoryOptions type](/api/core/types/history-options)
- [core module index](/api/core)
