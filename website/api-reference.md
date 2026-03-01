# API Reference

This section has two layers:

1. **Conceptual API guides** (recommended first)
2. **Generated type-level reference** (exact signatures)

If you are new to `scope-flux`, read conceptual guides first.
Then open Typedoc only when you need exact generic constraints or edge-case details.

## Conceptual Guides

- [Core API](/core-api)
- [React API](/react-api)
- [Scheduler API](/scheduler-api)
- [Serializer API](/serializer-api)
- [Inspect API](/inspect-api)

Recommended order:

1. Core
2. React
3. Scheduler
4. Serializer
5. Inspect

## Generated Reference

- [Typedoc](/api/index.html)

Use Typedoc when you need exact generic signatures and full exported symbol details.

## How to Read These Docs Efficiently

- Start with "When to use" and "Common pitfalls" in each page.
- Copy the small patterns first, then adapt.
- Keep write paths explicit (`set`, `emit`, `run`) and avoid hidden side effects in `computed`.
