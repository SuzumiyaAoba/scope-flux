# Test Plan

## 1. Contract Tests

### Core Snapshot Contract
- unchanged reads preserve identity (`Object.is`).
- changed writes produce new snapshot identity.
- returned snapshots are immutable by API contract.

### Computed Contract
- recompute only when dependency versions change.
- cycle detection emits deterministic error code.

### Scope Isolation Contract
- updates in forked scope do not leak to sibling/parent.

## 2. React/uSES Tests

- `useUnit` selector renders only on selected change.
- `getServerSnapshot` equals first client snapshot.
- provider boundary violations emit expected error.

## 3. Scheduler/Transition Tests

- urgent updates preempt transition queue.
- transition queue does not mutate committed source directly.
- buffer fallback behavior works under divergence.

## 4. Serialization/Security Tests

- non-JSON values rejected.
- schema-invalid payload rejected.
- oversize payload rejected.
- unknown stable ID handling follows policy.
- idempotent hydrate default verified.
- force hydrate warning path verified.

## 5. End-to-End Scenarios

- SSR render -> embed payload -> client hydrate parity.
- multi-request isolation in server environment.
- heavy UI update benchmark with transition mode.

## 6. CI Gates

- typecheck
- unit tests
- integration tests
- security regression suite
- benchmark smoke test (non-blocking)
