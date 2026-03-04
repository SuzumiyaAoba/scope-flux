# StoreProviderProps

## Kind

- interface

## Description

Props contract for StoreProvider.

## Example

```ts twoslash
import type { ReactNode } from 'react';
import { createStore } from '@suzumiyaaoba/scope-flux-core';
import type { StoreProviderProps } from '@suzumiyaaoba/scope-flux-react';

const store = createStore();
const children: ReactNode = 'hello';

const props: StoreProviderProps = {
  scope: store.scope,
  children,
};
props.scope.id;
// ^? string
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Where This Type Is Used

- Appears in public API signatures and composition boundaries for this module.
- Useful for app-level contracts, shared utility wrappers, and test helpers.

## Design Guidance

- Keep this type at API boundaries; avoid over-coupling internal business logic to tooling types.
- If you need runtime semantics, pair this page with the corresponding function docs.

## Review Checklist

- Is the type used at module boundaries where type safety matters most?
- Are literal unions handled exhaustively in your code (`switch`/guards)?
- Is the type aligned with serialization and observability constraints?

## Related

- [react module index](/api/react)
- [Typedoc root](/typedoc/index.html)
