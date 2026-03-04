# escapeJsonForHtml

## Signature

```ts
escapeJsonForHtml(json: string): string
```

## Description

Escapes dangerous code points for HTML-safe JSON embedding.

## Parameters

- `json`: JSON string (usually from `JSON.stringify`).

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts twoslash
import { escapeJsonForHtml } from '@suzumiyaaoba/scope-flux-serializer';

const payload = { text: '</script><script>alert(1)</script>' };
const raw = JSON.stringify(payload);
const safe = escapeJsonForHtml(raw);

const inlineScript = `<script>window.__SCOPE__ = JSON.parse('${safe}')</script>`;
void inlineScript;
```

## Notes

- Always escape serialized JSON before embedding in HTML to avoid script-breaking sequences.
- This function is for JSON transport safety, not for general-purpose HTML sanitization.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
