# ComputedArgs<D>

## Kind

- type

## Description

Argument tuple inferred from computed dependencies.

## Example

```ts
import type { ComputedArgs } from '@scope-flux/core';

// Use this type in your app-level contracts
type Example = ComputedArgs<any>;
void (null as unknown as Example);
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
