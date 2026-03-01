# Redux -> scope-flux

## Mapping

- `slice state` -> `cell`
- `selector` -> `computed`
- `action` -> `event`
- `thunk/async` -> `effect`

## Steps

1. Create cells for each slice field.
2. Replace selectors with computed units.
3. Replace dispatch calls with `scope.emit(event, payload)`.
4. Move async logic into `effect` and call via `scope.run`.
5. Replace preloaded state bootstrap with `serialize/hydrate`.
