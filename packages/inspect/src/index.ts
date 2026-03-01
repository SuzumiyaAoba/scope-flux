import type { AnyCell, Change, CommitEvent, Scope, Unsubscribe } from '@scope-flux/core';

export interface TraceEvent {
  id: string;
  ts: number;
  scopeId: string;
  kind: 'event' | 'effect' | 'set';
  unitId?: string;
  unitName?: string;
  priority?: 'urgent' | 'transition' | 'idle';
  reason?: string;
  parentId?: string;
}

export interface StateDiff {
  unitId?: string;
  unitName?: string;
  prev: unknown;
  next: unknown;
}

export interface InspectRecord {
  trace: TraceEvent;
  diffs: StateDiff[];
}

export interface InspectOptions {
  scope: Scope;
  trace?: boolean;
  sampleRate?: number;
  onRecord: (record: InspectRecord) => void;
}

export interface DevtoolsAdapter {
  init(initialState: unknown): void;
  send(action: { type: string; payload?: unknown }, state: unknown): void;
}

export interface ConnectDevtoolsOptions {
  scope: Scope;
  adapter: DevtoolsAdapter;
  trace?: boolean;
}

let traceSeq = 0;

function nextId(prefix: string): string {
  traceSeq += 1;
  return `${prefix}_${traceSeq}`;
}

function getUnitMeta(change: Change): { unitId?: string; unitName?: string } {
  const unit = change.unit as { meta?: { id?: string; debugName?: string } };
  return {
    unitId: unit.meta?.id,
    unitName: unit.meta?.debugName,
  };
}

function toRecord(scopeId: string, priority: CommitEvent['priority'], parentId: string | undefined, change: Change): InspectRecord {
  const meta = getUnitMeta(change);

  const trace: TraceEvent = {
    id: nextId('trace'),
    ts: Date.now(),
    scopeId,
    kind: change.kind,
    unitId: meta.unitId,
    unitName: meta.unitName,
    priority,
    reason: change.reason,
    parentId,
  };

  if (change.kind === 'set') {
    return {
      trace,
      diffs: [
        {
          unitId: meta.unitId,
          unitName: meta.unitName,
          prev: change.prev,
          next: change.next,
        },
      ],
    };
  }

  return {
    trace,
    diffs: [],
  };
}

function snapshotScope(scope: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const known = scope._listKnownCells() as AnyCell[];

  for (const cell of known) {
    const key = cell.meta.id ?? cell.meta.debugName ?? 'anonymous_cell';
    out[key] = scope.get(cell);
  }

  return out;
}

export function inspect(options: InspectOptions): Unsubscribe {
  const sampleRate = options.sampleRate ?? 1;
  if (sampleRate <= 0) {
    return () => {
      // no-op
    };
  }

  return options.scope.subscribe((commit) => {
    const parentId = options.trace ? nextId('commit') : undefined;

    for (const change of commit.changes) {
      if (Math.random() > sampleRate) {
        continue;
      }
      options.onRecord(toRecord(options.scope.id, commit.priority, parentId, change));
    }
  });
}

export function connectDevtools(options: ConnectDevtoolsOptions): Unsubscribe {
  const { scope, adapter } = options;

  adapter.init(snapshotScope(scope));

  return inspect({
    scope,
    trace: options.trace,
    onRecord: (record) => {
      const typeBase = record.trace.kind;
      const unitName = record.trace.unitId ?? record.trace.unitName ?? 'unknown';
      adapter.send(
        {
          type: `${typeBase}:${unitName}`,
          payload: {
            priority: record.trace.priority,
            reason: record.trace.reason,
            diffs: record.diffs,
          },
        },
        snapshotScope(scope)
      );
    },
  });
}

export { createReduxDevtoolsAdapter } from './redux-devtools.js';
export type {
  ReduxDevtoolsAdapter,
  ReduxDevtoolsAdapterOptions,
  ReduxDevtoolsLike,
} from './redux-devtools.js';
