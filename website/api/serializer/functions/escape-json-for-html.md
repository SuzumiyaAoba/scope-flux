# escapeJsonForHtml

## Signature

```ts
escapeJsonForHtml(json: string): string
```

## Description

Escapes dangerous code points for HTML-safe JSON embedding.

## Parameters

- `json`: JSON string (usually from `JSON.stringify`).

## Example

```ts
import { escapeJsonForHtml } from '@scope-flux/serializer';

const payload = { text: '</script><script>alert(1)</script>' };
const raw = JSON.stringify(payload);
const safe = escapeJsonForHtml(raw);

const inlineScript = `<script>window.__SCOPE__ = JSON.parse('${safe}')</script>`;
void inlineScript;
```

## Notes

- Always escape serialized JSON before embedding in HTML to avoid script-breaking sequences.
- This function is for JSON transport safety, not for general-purpose HTML sanitization.

## Related

- [serializer module index](/api/serializer)
- [serializer module guide](/api/serializer)
- [Typedoc root](/typedoc/index.html)
