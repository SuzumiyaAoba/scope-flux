# Philosophy

## Core Design Statement

scope-flux is designed as a deterministic, scope-isolated, React-friendly state runtime that prioritizes rendering correctness first, then transition-aware UX optimization.

## Principles

1. Correctness before convenience
- The default path must be tear-free and predictable.
- Transition optimization is opt-in and constrained by explicit priority rules.

2. Scope-first isolation
- Store instances are explicit; implicit global singleton usage is discouraged.
- SSR/RSC safety depends on request-level scope boundaries.

3. Explicit dataflow
- State writes should be explainable via `event`/`effect` chains.
- Derived state (`computed`) must stay pure and cacheable.

4. Replaceable React bridge
- Core runtime does not depend on React internals.
- The React bridge is an adapter layer around runtime contracts.

5. Secure-by-default transport
- Serialization is treated as untrusted I/O.
- Hydration is validated, bounded, and reproducible.

6. Observability as a first-class capability
- Tracing is built in conceptually, separated physically.
- Production overhead is minimized by packaging isolation.

## Explicit Trade-offs

- We accept extra API surface (`priority`, hydration modes) to keep behavior explicit.
- We avoid hidden global behavior to reduce accidental cross-request leaks.
- We keep statechart integration out of core to preserve adoption simplicity.
