import type { AnyCell, Change, CommitEvent, Scope, Unsubscribe } from '@suzumiyaaoba/scope-flux-core';

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

function getUnitMeta(change: Change): { unitId?: string; unitName?: string } {
  const { meta } = change.unit;
  return {
    unitId: meta?.id,
    unitName: meta?.debugName,
  };
}

function toRecord(
  scopeId: string,
  priority: CommitEvent['priority'],
  parentId: string | undefined,
  change: Change,
  nextId: (prefix: string) => string,
): InspectRecord {
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

  for (let i = 0; i < known.length; i++) {
    const cell = known[i];
    const key = cell.meta.id ?? cell.meta.debugName ?? `anonymous_${i}`;
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

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  return options.scope.subscribe((commit) => {
    const parentId = options.trace ? nextId('commit') : undefined;

    for (const change of commit.changes) {
      if (Math.random() >= sampleRate) {
        continue;
      }
      options.onRecord(toRecord(options.scope.id, commit.priority, parentId, change, nextId));
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
