# Redux -> scope-flux

This guide assumes you currently use reducers/selectors/thunks and want an incremental migration.

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

## Practical Notes

- Keep existing Redux store for untouched features while migrating one slice.
- Start with read-only selectors first, then move writes.
- Use `reason` metadata on updates to keep inspect traces easy to follow.

## Risk Checklist

- ensure no direct mutation remains in migrated paths
- keep one scope per request in SSR
- verify hydration payload contains only intended cells
