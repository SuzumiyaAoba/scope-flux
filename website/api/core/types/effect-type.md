# Effect<P, R>

## Kind

- interface

## Description

Effect unit shape and handler contract.

## Example

```ts
import type { Effect } from '@scope-flux/core';

// Use this type in your app-level contracts
type Example = Effect<any, any>;
void (null as unknown as Example);
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
