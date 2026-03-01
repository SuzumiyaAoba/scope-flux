# Valtio / MobX -> scope-flux

This migration focuses on replacing implicit reactive mutation with explicit state transitions.

## Mapping

- `proxy/observable state` -> explicit `cell`s
- `computed/getter` -> `computed`
- `actions` -> `event` or `useCellAction`

## Steps

1. Identify mutable observable roots and convert them to cells.
2. Move derivations to computed units.
3. Replace implicit mutation flows with explicit event/effect pipelines.
4. Use `useBufferedUnit` + `useCellAction({ priority: 'transition' })` for heavy UI updates.

## Practical Notes

- Start by freezing the public mutation API of existing stores.
- Recreate those APIs as explicit actions (`event`, `useCellAction`, `effect`).
- Keep object graphs normalized where possible to reduce update fan-out.

## Risk Checklist

- remove direct observable/proxy mutation from migrated components
- ensure computed values are pure and deterministic
- verify performance when moving from implicit tracking to explicit derivation
