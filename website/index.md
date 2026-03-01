# scope-flux

`scope-flux` is a TypeScript-first state management library for modern React apps.

It is designed for teams that want:

- explicit and testable state updates
- isolated runtime scopes for SSR/tests/features
- predictable hydration and serialization boundaries
- optional buffered updates for smoother UI interaction

If you are evaluating whether `scope-flux` fits your project, start here, then continue to Getting Started and Tutorial.

## Highlights

- Tear-free rendering with explicit scope-based state.
- Transition-friendly buffered updates via scheduler integration.
- Safe SSR/RSC hydration model (`serialize` / `hydrate`).
- First-class observability (`inspect`, DevTools adapter).

## Mental Model

`scope-flux` separates runtime responsibilities into clear layers:

- `cell`: mutable source of truth
- `computed`: pure derived value
- `event` / `effect`: explicit action and side-effect boundaries
- `scope`: isolated runtime container for reads/writes/subscriptions

This separation helps keep UI components small and business logic portable.

## Packages

- `@scope-flux/core`
- `@scope-flux/react`
- `@scope-flux/scheduler`
- `@scope-flux/serializer`
- `@scope-flux/inspect`

You can adopt only the packages you need. For example, non-React logic can start with `@scope-flux/core` only.

## Suggested Reading Order

1. [Getting Started](/getting-started): install and first runnable example.
2. [Tutorial: Build a Todo App](/tutorial-todo): end-to-end practical flow.
3. [Architecture](/architecture): runtime design and tradeoffs.
4. API pages by package:
   - [Core API](/api/core)
   - [React API](/api/react)
   - [Scheduler API](/api/scheduler)
   - [Serializer API](/api/serializer)
   - [Inspect API](/api/inspect)
5. [Typedoc](/typedoc/index.html): exact signatures and exported symbols.

## Next

- [Getting Started](/getting-started)
- [Architecture](/architecture)
- [Tutorial: Build a Todo App](/tutorial-todo)
- [Migration Guides](/migration/)
- [Typedoc](/typedoc/index.html)
