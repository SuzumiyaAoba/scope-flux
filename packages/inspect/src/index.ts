import {
  getRegisteredCellById,
  isObject,
  type AnyCell,
  type Change,
  type CommitEvent,
  type Priority,
  type Scope,
  type Unsubscribe,
} from '@suzumiyaaoba/scope-flux-core';

export interface TraceEvent {
  id: string;
  ts: number;
  scopeId: string;
  kind: 'event' | 'effect' | 'set';
  unitId?: string;
  unitName?: string;
  priority?: Priority;
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
  subscribe?(listener: (message: DevtoolsMessage) => void): Unsubscribe | undefined;
}

export interface DevtoolsMessage {
  type:
    | 'jump_to_state'
    | 'jump_to_action'
    | 'import_state'
    | 'reset'
    | 'rollback'
    | 'commit'
    | 'revert';
  state?: unknown;
  nextLiftedState?: unknown;
}

export interface ConnectDevtoolsOptions {
  scope: Scope;
  adapter: DevtoolsAdapter;
  trace?: boolean;
  onError?: (error: unknown, phase: 'init' | 'send' | 'receive') => void;
  onUnsupportedMessage?: (message: DevtoolsMessage) => void;
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

function readImportState(message: DevtoolsMessage): Record<string, unknown> | null {
  if (
    (
      message.type === 'jump_to_state' ||
      message.type === 'jump_to_action' ||
      message.type === 'rollback' ||
      message.type === 'revert' ||
      message.type === 'reset'
    ) &&
    isObject(message.state)
  ) {
    return message.state as Record<string, unknown>;
  }

  if (message.type !== 'import_state') {
    return null;
  }

  if (isObject(message.nextLiftedState)) {
    const computedStates = message.nextLiftedState.computedStates;
    if (Array.isArray(computedStates) && computedStates.length > 0) {
      const latest = computedStates[computedStates.length - 1];
      if (isObject(latest) && isObject(latest.state)) {
        return latest.state as Record<string, unknown>;
      }
    }
  }

  if (isObject(message.state)) {
    return message.state as Record<string, unknown>;
  }

  return null;
}

function applySnapshot(scope: Scope, snapshot: Record<string, unknown>, reason: string): void {
  scope.batch(() => {
    for (const [key, value] of Object.entries(snapshot)) {
      const cellUnit = getRegisteredCellById(key);
      if (!cellUnit) {
        continue;
      }
      scope.set(cellUnit as AnyCell, value, {
        reason,
        priority: 'urgent',
      });
    }
  });
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
      if (sampleRate < 1 && Math.random() >= sampleRate) {
        continue;
      }
      options.onRecord(toRecord(options.scope.id, commit.priority, parentId, change, nextId));
    }
  });
}

export function connectDevtools(options: ConnectDevtoolsOptions): Unsubscribe {
  const { scope, adapter } = options;
  const initialSnapshot = snapshotScope(scope);

  try {
    adapter.init(initialSnapshot);
  } catch (error) {
    options.onError?.(error, 'init');
  }

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;
  let applyingFromDevtools = false;

  const unsubscribeScope = scope.subscribe((commit) => {
    if (applyingFromDevtools) {
      return;
    }
    const snapshot = snapshotScope(scope);
    const parentId = options.trace ? nextId('commit') : undefined;

    for (const change of commit.changes) {
      const record = toRecord(scope.id, commit.priority, parentId, change, nextId);
      const typeBase = record.trace.kind;
      const unitName = record.trace.unitId ?? record.trace.unitName ?? 'unknown';
      try {
        adapter.send(
          {
            type: `${typeBase}:${unitName}`,
            payload: {
              priority: record.trace.priority,
              reason: record.trace.reason,
              diffs: record.diffs,
            },
          },
          snapshot
        );
      } catch (error) {
        options.onError?.(error, 'send');
      }
    }
  });

  const unsubscribeAdapter = adapter.subscribe?.((message) => {
    try {
      if (message.type === 'commit') {
        adapter.init(snapshotScope(scope));
        return;
      }

      if (message.type === 'reset') {
        const resetSnapshot = readImportState(message) ?? initialSnapshot;
        applyingFromDevtools = true;
        try {
          applySnapshot(scope, resetSnapshot, 'devtools.reset');
        } finally {
          applyingFromDevtools = false;
        }
        return;
      }

    const snapshot = readImportState(message);
    if (!snapshot) {
      options.onUnsupportedMessage?.(message);
      return;
    }
      applyingFromDevtools = true;
      try {
        applySnapshot(scope, snapshot, `devtools.${message.type}`);
      } finally {
        applyingFromDevtools = false;
      }
    } catch (error) {
      options.onError?.(error, 'receive');
    }
  });

  return () => {
    unsubscribeScope();
    if (typeof unsubscribeAdapter === 'function') {
      unsubscribeAdapter();
    }
  };
}

export { createReduxDevtoolsAdapter } from './redux-devtools.js';
export type {
  ReduxDevtoolsAdapter,
  ReduxDevtoolsAdapterOptions,
  ReduxDevtoolsLike,
} from './redux-devtools.js';
