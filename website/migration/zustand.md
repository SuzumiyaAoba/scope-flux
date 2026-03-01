# Zustand -> scope-flux

This migration is usually straightforward because both approaches are lightweight and hook-friendly.

## Mapping

- `store state` -> `cell` set
- `derived selectors` -> `computed`
- `set()` actions -> `useCellAction` or `scope.set`

## Steps

1. Split a Zustand store into explicit cells.
2. Move derived selectors to computed units.
3. Replace direct `set` usage with events/cell actions.
4. Keep persistence at serializer boundary (`serialize/hydrate`).

## Practical Notes

- Replace broad object stores with smaller explicit cells where possible.
- Keep computed units free of side effects.
- Use selector + equality in `useUnit` for large collections.

## Risk Checklist

- avoid accidental in-place mutation of arrays/objects
- ensure stable ids for persisted/hydrated cells
- confirm buffered writes are flushed at expected UI boundaries
