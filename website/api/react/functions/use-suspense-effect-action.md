# useSuspenseEffectAction

## Signature

```ts
useSuspenseEffectAction<P, R>(
  effect: Effect<P, R>,
  options?: { priority?: Priority; reason?: string }
): {
  run: (payload: P) => Promise<R>;
  cancel: () => void;
  status: EffectStatus<R>;
  read: () => R;
}
```

## Description

Like `useAsyncEffectAction`, but adds a `read()` function that integrates with React Suspense. Calling `read()` while the effect is in-flight throws the pending promise, triggering the nearest `<Suspense>` boundary.

## Parameters

- `effect`: the effect unit to execute.
- `options.priority`: update priority.
- `options.reason`: reason string for observability.

## Return Value

- `run(payload)`: starts the effect and returns a promise.
- `cancel()`: aborts the running effect.
- `status`: current `EffectStatus<R>`.
- `read()`: returns the last result, or throws the in-flight promise for Suspense.

## Example

```tsx
const { run, read } = useSuspenseEffectAction(fetchDataFx);

// In an event handler:
run({ id: 123 });

// In render (inside Suspense boundary):
const data = read();
```

## Related

- [useAsyncEffectAction](/api/react/functions/use-async-effect-action)
- [useEffectAction](/api/react/functions/use-effect-action)
- [react module index](/api/react)
