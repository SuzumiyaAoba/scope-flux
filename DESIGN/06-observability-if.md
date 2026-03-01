# Observability and DevTools Interface

## Package Boundary

- Core package has no hard dependency on inspector.
- Inspector package subscribes through public runtime hooks.

## Event Model

```ts
export interface TraceEvent {
  id: string;
  ts: number;
  scopeId: string;
  kind: 'event' | 'effect' | 'set' | 'compute' | 'hydrate';
  unitId?: StableId;
  priority?: Priority;
  reason?: string;
  parentId?: string;
}

export interface StateDiff {
  unitId: StableId;
  prev: unknown;
  next: unknown;
}

export interface InspectRecord {
  trace: TraceEvent;
  diffs: StateDiff[];
}
```

## API

```ts
export interface InspectOptions {
  scope?: Scope;
  trace?: boolean;
  onRecord: (record: InspectRecord) => void;
}

export function inspect(options: InspectOptions): Unsubscribe;

export interface DevtoolsAdapter {
  init(initialState: unknown): void;
  send(action: { type: string; payload?: unknown }, state: unknown): void;
}

export function connectDevtools(adapter: DevtoolsAdapter): Unsubscribe;
```

## Requirements

- Trace chain reconstruction (`parentId`) for causality.
- Sampling/throttling support for high-frequency updates.
- Build-time removability (tree-shake friendly ESM exports).
