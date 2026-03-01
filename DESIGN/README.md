# DESIGN

Detailed design documents for scope-flux.

## Document Map

- `WORK-BREAKDOWN.md`
  - Implementation task breakdown from `PLAN.md` into executable work items.
- `01-philosophy.md`
  - Core design philosophy, constraints, and architectural boundaries.
- `02-core-store-if.md`
  - Core runtime model and TypeScript interfaces.
- `03-react-bridge-if.md`
  - React integration interfaces and `useSyncExternalStore` contracts.
- `04-serialization-security-if.md`
  - SSR/RSC state transport format, hydration rules, and security constraints.
- `05-scheduler-two-layer-if.md`
  - Two-layer update model and priority scheduling behavior.
- `06-observability-if.md`
  - Inspector and DevTools adapter interface design.
- `07-test-plan.md`
  - Contract tests, concurrency tests, and security regression matrix.

## Reading Order

1. `01-philosophy.md`
2. `02-core-store-if.md`
3. `03-react-bridge-if.md`
4. `04-serialization-security-if.md`
5. `05-scheduler-two-layer-if.md`
6. `06-observability-if.md`
7. `WORK-BREAKDOWN.md`
8. `07-test-plan.md`
