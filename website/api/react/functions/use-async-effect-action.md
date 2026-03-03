# useAsyncEffectAction

## Signature

```ts
useAsyncEffectAction<P, R>(
  effect: Effect<P, R>,
  options?: { priority?: Priority; reason?: string }
): {
  run: (payload: P) => Promise<R>;
  cancel: () => void;
  status: EffectStatus<R>;
}
```

## Description

Convenience hook that combines effect invocation, cancellation, and status tracking.

## Example

```tsx
const { run, cancel, status } = useAsyncEffectAction(fetchUserFx, {
  reason: 'profile.open',
});

// run(...)
// cancel()
// status.running / status.lastError / status.lastResult
```

## Related

- [react module index](/api/react)
- [Typedoc root](/typedoc/index.html)
