# useFlushBuffered

## Signature

```ts
useFlushBuffered(): () => void
```

## Description

Returns a function that flushes scheduler buffered updates.

## Parameters

- No parameters.

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

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
