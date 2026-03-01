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

## Related

- [react module index](/api/react)
- [react module guide](/api/react)
- [Typedoc root](/typedoc/index.html)
