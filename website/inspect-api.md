# Inspect API

`@scope-flux/inspect` provides runtime observability and DevTools integration.

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

### `createReduxDevtoolsAdapter({ extension?, name? })`
Creates adapter for Redux DevTools extension.

- If extension is missing, returns no-op adapter.

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

## Example: Production-safe Sampling

```ts
const stop = inspect({
  scope,
  trace: true,
  sampleRate: 0.1,
  onRecord: (record) => sendToTelemetry(record),
});
```

Use low sample rates in high-traffic environments to reduce telemetry overhead.

## Example: Console Trace

```ts
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
