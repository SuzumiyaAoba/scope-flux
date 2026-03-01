# Zustand -> scope-flux

## Mapping

- `store state` -> `cell` set
- `derived selectors` -> `computed`
- `set()` actions -> `useCellAction` or `scope.set`

## Steps

1. Split a Zustand store into explicit cells.
2. Move derived selectors to computed units.
3. Replace direct `set` usage with events/cell actions.
4. Keep persistence at serializer boundary (`serialize/hydrate`).
