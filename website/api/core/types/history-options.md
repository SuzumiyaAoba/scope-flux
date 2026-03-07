# HistoryOptions

## Kind

- interface

## Description

Options for `createHistoryController()`.

## Properties

- `limit?: number` — maximum undo entries (default `100`).
- `track?: Cell<any>[]` — if provided, only track changes to these cells.
- `reasonPrefix?: string` — prefix for undo/redo commit reasons (default `'history'`).

## Related

- [createHistoryController](/api/core/functions/create-history-controller)
- [HistoryController](/api/core/types/history-controller)
- [core module index](/api/core)
