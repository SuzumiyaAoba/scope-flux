# Jotai -> scope-flux

Both libraries use explicit units, so conceptual migration is usually low friction.

## Mapping

- `atom` -> `cell`
- `derived atom` -> `computed`
- `write atom` -> `event` + handlers or `useCellAction`

## Steps

1. Convert base atoms to cells.
2. Convert derived atoms to computed units.
3. Replace write atoms with events or cell actions.
4. Use `hydrate(..., { mode: 'safe' })` for deterministic initialization.

## Practical Notes

- Migrate critical atoms first (auth/session/form state), then peripheral ones.
- Keep write behavior explicit in actions to simplify debugging.
- Group related updates with `scope.batch` when they represent one user action.

## Risk Checklist

- avoid hidden side effects inside computed derivations
- verify migrated components are wrapped by `StoreProvider`
- keep unit ids stable if serializer is enabled
