# DevtoolsAdapter

## Kind

- interface

## Description

Minimal adapter contract used by `connectDevtools`.

## Example

```ts
import type { DevtoolsAdapter } from '@scope-flux/inspect';

// Use this type in your app-level contracts
type Example = DevtoolsAdapter;
void (null as unknown as Example);
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [inspect module index](/api/inspect)
- [Typedoc root](/typedoc/index.html)
