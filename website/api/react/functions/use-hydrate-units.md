# useHydrateUnits

## Signature

```ts
useHydrateUnits(
  seed: SeedInput | undefined,
  options?: { force?: boolean }
): void
```

## Description

Hydrates cells from a seed map during render. This hook runs hydration at render time (not in `useEffect`) to ensure values are available on the first read.

## Parameters

- `seed`: a `Map<Cell, value>` or `Array<[Cell, value]>` of cell values to hydrate, or `undefined` to skip.
- `options.force`: if `true`, re-hydrates on every render (useful for reactive seed values). If `false` (default), each cell is hydrated at most once per scope.

## Behavior

- **Default mode** (`force: false`): Hydration runs at render time. Each cell ID is hydrated only once per scope, tracked via `scope.isHydrated()`.
- **Force mode** (`force: true`): Hydration runs in `useEffect` on every render. Scope's internal equality check prevents unnecessary notifications.

## Example

```tsx
import { useHydrateUnits } from '@suzumiyaaoba/scope-flux-react';

function HydratedPage({ serverState }: { serverState: Map<Cell<any>, unknown> }) {
  useHydrateUnits(serverState);
  // ... cells are now hydrated for this render
}
```

## Notes

- Always call this hook unconditionally (React Rules of Hooks).
- Pass `undefined` as seed to skip hydration without violating hook rules.

## Related

- [serialize / hydrate (serializer)](/api/serializer/functions/hydrate)
- [react module index](/api/react)
