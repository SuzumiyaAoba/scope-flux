# useEffectAction

## Signature

```ts
useEffectAction(effect, options?): (payload) => Promise<R>
```

## Description

Returns effect invoker callback.

## Parameters

- `effect`: target effect.
- `options.priority`: optional priority.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { effect, cell } from '@scope-flux/core';
import { useEffectAction, useCellAction, useUnit } from '@scope-flux/react';

const status = cell<'idle' | 'loading' | 'done'>('idle', { id: 'user.status' });
const loadFx = effect(async (id: string) => ({ id, name: 'Aoba' }));

function LoadButton() {
  const state = useUnit(status);
  const setStatus = useCellAction(status, { reason: 'user.load' });
  const run = useEffectAction(loadFx);

  const onClick = async () => {
    setStatus('loading');
    await run('u1');
    setStatus('done');
  };

  return <button onClick={() => void onClick()}>state: {state}</button>;
}
```

## Notes

- Use this hook to execute typed async effects from UI events.
- Keep loading/error state in cells so status transitions are observable and testable.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
