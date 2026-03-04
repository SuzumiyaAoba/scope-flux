# Inspect API

`@suzumiyaaoba/scope-flux-inspect` provides runtime observability and DevTools integration.

Use this package to answer:

- which unit changed
- why it changed (`reason`)
- with what priority
- what value diff was produced

## Main APIs

### `inspect({ scope, trace?, sampleRate?, onRecord })`
Subscribes to commit stream and emits normalized records.

- `trace`: include parent commit relation (`parentId`)
- `sampleRate`: 0..1 sampling ratio for high-frequency updates
- `onRecord`: callback for logging/telemetry/debug UI

`inspect()` returns an unsubscribe function. Call it when tracing is no longer needed.

### `connectDevtools({ scope, adapter, trace? })`
Bridges inspect records to a DevTools-like adapter.

When adapter supports `subscribe`, inbound messages are also handled:

- `jump_to_state`
- `import_state`

Error handling:

- `onError(error, phase)` option is available for `init` / `send` / `receive` failures.
- `onUnsupportedMessage(message)` can be used to inspect inbound messages that were ignored.

### `createReduxDevtoolsAdapter({ extension?, name? })`
Creates adapter for Redux DevTools extension.

- If extension is missing, returns no-op adapter.

### `mountInspectPanel({ scope, target?, maxRecords?, trace?, sampleRate?, title? })`
Mounts a lightweight official inspect panel into DOM.

- Useful for in-app debug overlays without Redux DevTools extension.
- Returns controller with `unsubscribe`, `clear`, `destroy`, `getRecords`.

## Arguments Reference

### `inspect(options)`

- `options: InspectOptions`
  - `scope: Scope`
    - Scope to observe.
  - `trace?: boolean`
    - When `true`, attaches commit-level `parentId`.
  - `sampleRate?: number`
    - Sampling ratio in range 0..1. Default is `1`.
    - If `<= 0`, returns a no-op unsubscribe.
  - `onRecord: (record: InspectRecord) => void`
    - Callback invoked for each sampled record.
- Returns: `Unsubscribe`

### `connectDevtools(options)`

- `options: ConnectDevtoolsOptions`
  - `scope: Scope`
  - `adapter: DevtoolsAdapter`
    - Adapter implementing `init` and `send`.
    - Optional `subscribe` for inbound state import/jump events.
  - `trace?: boolean`
    - Same trace behavior as `inspect`.
  - `onError?: (error: unknown, phase: 'init' | 'send' | 'receive') => void`
  - `onUnsupportedMessage?: (message: DevtoolsMessage) => void`
- Returns: `Unsubscribe`

### `createReduxDevtoolsAdapter(options?)`

- `options?: ReduxDevtoolsAdapterOptions`
  - `extension?: ReduxDevtoolsLike`
    - Use this to inject extension explicitly.
  - `name?: string`
    - DevTools connection name. Default is `'scope-flux'`.
- Returns: `ReduxDevtoolsAdapter`
  - Returns no-op adapter when extension is unavailable.

## Inspect Record Model

```ts
interface InspectRecord {
  trace: {
    id: string;
    kind: 'set' | 'event' | 'effect';
    unitId?: string;
    unitName?: string;
    priority?: 'urgent' | 'transition' | 'idle';
    reason?: string;
    parentId?: string;
  };
  diffs: Array<{ prev: unknown; next: unknown }>;
}
```

- `diffs` is populated for `set` changes.
- `event/effect` typically carry trace metadata only.

## Literal Union Values

### `TraceEvent.kind`

- `'set'`
  - Cell value update.
- `'event'`
  - Event emission.
- `'effect'`
  - Effect execution.

### `TraceEvent.priority`

- `'urgent'`
  - Immediate update.
- `'transition'`
  - Transition-priority update.
- `'idle'`
  - Low-priority update.

## Example: Production-safe Sampling

```ts twoslash
const stop = inspect({
  scope,
  trace: true,
  sampleRate: 0.1,
  onRecord: (record) => sendToTelemetry(record),
});
```

Use low sample rates in high-traffic environments to reduce telemetry overhead.

## Example: Console Trace

```ts twoslash
const stop = inspect({
  scope,
  trace: true,
  sampleRate: 1,
  onRecord: (record) => {
    console.log(record.trace.kind, record.trace.unitId, record.diffs);
  },
});

// ...
stop();
```

## Common Pitfalls

- forgetting to unsubscribe in long-lived debug sessions
- setting `sampleRate: 1` in production without telemetry budget
- logging full diffs of sensitive data

## Example

```ts twoslash
import { createStore } from '@suzumiyaaoba/scope-flux-core';
import { inspect, connectDevtools, createReduxDevtoolsAdapter } from '@suzumiyaaoba/scope-flux-inspect';

const scope = createStore().fork();

const stopInspect = inspect({
  scope,
  trace: true,
  sampleRate: 0.2,
  onRecord: (record) => console.log(record.trace.kind, record.trace.reason),
});

const stopDevtools = connectDevtools({
  scope,
  adapter: createReduxDevtoolsAdapter({ name: 'scope-flux-app' }),
  trace: true,
});

// stopInspect();
// stopDevtools();
```

## Notes

- Keep sampling low in production to control overhead.
- Always unsubscribe (`stopInspect` / `stopDevtools`) when observers are no longer needed.
- Inbound devtools state import is applied only for known stable IDs.


## Reading Guide

- Start with this page for concepts and argument intent.
- Open `/api/<module>/functions/*` for operational usage patterns.
- Open `/api/<module>/types/*` for boundary contracts and type-level constraints.

## Production Checklist

- Define stable IDs for states that must be serialized or inspected.
- Attach `reason` metadata for important updates and side effects.
- Prefer explicit flush/hydration boundaries rather than implicit state transitions.
