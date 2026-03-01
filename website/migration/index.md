# Migration Guides

This section helps you migrate incrementally from existing state libraries to `scope-flux`.

You do not need a big-bang rewrite.
In most projects, migration is safest when done feature by feature.

## Recommended Migration Strategy

1. Start with one isolated feature (for example, search panel or settings page).
2. Move raw mutable state to `cell`.
3. Move selectors/derived logic to `computed`.
4. Move action and async boundaries to `event` / `effect`.
5. Add serializer and inspect only after core flows are stable.

## Guides

- `redux.md`
- `zustand.md`
- `jotai.md`
- `valtio-mobx.md`

## Cross-library Checklist

- define stable ids for state that may be hydrated
- keep derivations pure
- avoid sharing one scope across SSR requests
- add tests around migrated feature before moving next area
