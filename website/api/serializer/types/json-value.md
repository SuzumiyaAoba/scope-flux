# JsonValue

## Kind

- type

## Description

JSON-domain recursive value union.

## Example

```ts
import type { JsonValue } from '@scope-flux/serializer';

// Use this type in your app-level contracts
type Example = JsonValue;
void (null as unknown as Example);
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [serializer module index](/api/serializer)
- [Typedoc root](/typedoc/index.html)
