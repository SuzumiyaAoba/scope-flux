# useEffectStatus

## Signature

```ts
useEffectStatus<P, R>(effect: Effect<P, R>): EffectStatus<R>
```

## Description

Subscribes to runtime status of an effect.

Use this hook when you need loading/error/result state from `scope.run` executions.

## Example

```tsx
const status = useEffectStatus(fetchUserFx);

if (status.running > 0) return <Spinner />;
if (status.lastError) return <ErrorView />;
```

## Related

- [react module index](/api/react)
- [Typedoc root](/typedoc/index.html)
