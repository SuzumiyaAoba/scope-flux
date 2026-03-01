# Jotai -> scope-flux

## Mapping

- `atom` -> `cell`
- `derived atom` -> `computed`
- `write atom` -> `event` + handlers or `useCellAction`

## Steps

1. Convert base atoms to cells.
2. Convert derived atoms to computed units.
3. Replace write atoms with events or cell actions.
4. Use `hydrate(..., { mode: 'safe' })` for deterministic initialization.
