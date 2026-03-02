# useCell

## Signature

```ts
useCell(cell, options?): [value, setValue]
```

## Description

Combined read/write hook similar to `useState`.

## Parameters

- `cell`: target cell.
- `options`: same as `useCellAction`.


## Literal Union Values

- `priority` accepts: `"urgent" | "transition" | "idle"`.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```tsx
import { cell } from '@scope-flux/core';
import { useCell, useFlushBuffered } from '@scope-flux/react';

const draftTitle = cell('', { id: 'editor.draftTitle' });

function TitleInput() {
  const [title, setTitle] = useCell(draftTitle, {
    priority: 'transition',
    reason: 'editor.typing',
  });
  const flush = useFlushBuffered();

  return (
    <>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button onClick={() => flush()}>Save Draft</button>
    </>
  );
}
```

## Notes

- `useCell` gives `[value, setter]` ergonomics similar to React `useState`.
- Use `transition` for draft edits and flush when you want authoritative commit.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
