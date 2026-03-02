# useFlushBuffered

## Signature

```ts
useFlushBuffered(): () => void
```

## Description

Returns a function that flushes scheduler buffered updates.

## Parameters

- No parameters.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { cell } from '@scope-flux/core';
import { useCellAction, useBufferedUnit, useFlushBuffered } from '@scope-flux/react';

const name = cell('', { id: 'profile.name' });

function ProfileNameField() {
  const value = useBufferedUnit(name);
  const setName = useCellAction(name, { priority: 'transition', reason: 'profile.edit' });
  const flush = useFlushBuffered();

  return (
    <>
      <input value={value} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => flush()}>Apply</button>
    </>
  );
}
```

## Notes

- Call `flush` at UX boundaries such as blur, submit, or navigation.
- Buffered updates remain staged until flushed, so committed readers do not see them immediately.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
