# Valtio / MobX -> scope-flux

## Mapping

- `proxy/observable state` -> explicit `cell`s
- `computed/getter` -> `computed`
- `actions` -> `event` or `useCellAction`

## Steps

1. Identify mutable observable roots and convert them to cells.
2. Move derivations to computed units.
3. Replace implicit mutation flows with explicit event/effect pipelines.
4. Use `useBufferedUnit` + `useCellAction({ priority: 'transition' })` for heavy UI updates.
