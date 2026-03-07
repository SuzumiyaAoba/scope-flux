# HistoryController

## Kind

- interface

## Description

Returned by `createHistoryController()`. Provides undo/redo operations on a scope.

## Properties

- `undo(): boolean` — revert the last change.
- `redo(): boolean` — re-apply the last undone change.
- `clear(): void` — clear undo and redo stacks.
- `canUndo(): boolean` / `canRedo(): boolean` — check availability.
- `getSize(): { undo: number; redo: number }` — stack sizes.
- `unsubscribe(): void` — stop tracking changes.

## Related

- [createHistoryController](/api/core/functions/create-history-controller)
- [HistoryOptions](/api/core/types/history-options)
- [core module index](/api/core)
