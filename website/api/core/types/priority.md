# Priority

## Kind

- type

## Description

Literal union of update priority values.

## Literal Union Values

- `urgent`: immediate commit/update path.
- `transition`: transition-priority staged update path.
- `idle`: low-priority staged update path.

## Example

```ts
import type { Priority } from '@scope-flux/core';

const priority: Priority = 'urgent';
void priority;
```

## Notes

- This example shows how to consume the type in application code.
- For exact structural details, compare with Typedoc.

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
