import {
  type Cell,
  type Change,
  type CommitEvent,
  type Computed,
  type Priority,
  type Scope,
  type Unsubscribe,
} from '@suzumiyaaoba/scope-flux-core';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
  resolveUnit?: (key: string, scope: Scope) => Cell<any> | undefined;
  onError?: (error: unknown, phase: 'init' | 'send' | 'receive') => void;
  onUnsupportedMessage?: (message: DevtoolsMessage) => void;
}

interface PanelElementLike {
  className: string;
  textContent: string | null;
  innerHTML: string;
  appendChild(node: PanelElementLike): unknown;
  remove(): void;
}

interface PanelDocumentLike {
  createElement(tag: string): PanelElementLike;
}

interface PanelTargetLike {
  appendChild(node: PanelElementLike): unknown;
}

export interface InspectPanelOptions {
  scope: Scope;
  target?: PanelTargetLike;
  title?: string;
  maxRecords?: number;
  trace?: boolean;
  sampleRate?: number;
}

export interface InspectPanelController {
  unsubscribe(): void;
  clear(): void;
  destroy(): void;
  getRecords(): InspectRecord[];
}

function resolvePanelDocument(): PanelDocumentLike {
  const g = globalThis as { document?: PanelDocumentLike };
  if (!g.document) {
    throw new Error('NS_INSPECT_PANEL_DOM_UNAVAILABLE');
  }
  return g.document;
}

function resolvePanelTarget(documentRef: PanelDocumentLike, target?: PanelTargetLike): PanelTargetLike {
  if (target) {
    return target;
  }
  const g = globalThis as { document?: { body?: PanelTargetLike } };
  if (g.document?.body) {
    return g.document.body;
  }
  const fallback = documentRef.createElement('div');
  return {
    appendChild(node: PanelElementLike) {
      return fallback.appendChild(node);
    },
  };
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
  const known = scope.listKnownCells();

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

function applySnapshot(
  scope: Scope,
  snapshot: Record<string, unknown>,
  reason: string,
  resolveUnit?: (key: string, scope: Scope) => Cell<any> | undefined,
): void {
  const cells = scope.listRegisteredCells();
  const byDebugName = new Map<string, Cell<any>>();
  const duplicatedDebugNames = new Set<string>();
  for (const cell of cells) {
    const debugName = cell.meta?.debugName;
    if (!debugName) {
      continue;
    }
    if (byDebugName.has(debugName)) {
      duplicatedDebugNames.add(debugName);
      byDebugName.delete(debugName);
      continue;
    }
    byDebugName.set(debugName, cell);
  }

  scope.batch(() => {
    for (const [key, value] of Object.entries(snapshot)) {
      const cellUnit = resolveUnit?.(key, scope)
        ?? scope.getRegisteredCellById(key)
        ?? (!duplicatedDebugNames.has(key) ? byDebugName.get(key) : undefined);
      if (!cellUnit) {
        continue;
      }
      scope.set(cellUnit, value, {
        reason,
        priority: 'urgent',
      });
    }
  });
}

export function inspect(options: InspectOptions): Unsubscribe {
  const sampleRate = Math.max(0, Math.min(1, options.sampleRate ?? 1));
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
          applySnapshot(scope, resetSnapshot, 'devtools.reset', options.resolveUnit);
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
        applySnapshot(scope, snapshot, `devtools.${message.type}`, options.resolveUnit);
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

export function mountInspectPanel(options: InspectPanelOptions): InspectPanelController {
  const documentRef = resolvePanelDocument();
  const target = resolvePanelTarget(documentRef, options.target);
  const maxRecords = Math.max(1, options.maxRecords ?? 100);
  const records: InspectRecord[] = [];

  const root = documentRef.createElement('section');
  root.className = 'scope-flux-inspect-panel';

  const title = documentRef.createElement('h3');
  title.className = 'scope-flux-inspect-panel__title';
  title.textContent = options.title ?? 'scope-flux Inspect';

  const list = documentRef.createElement('pre');
  list.className = 'scope-flux-inspect-panel__records';
  list.textContent = '';

  root.appendChild(title);
  root.appendChild(list);
  target.appendChild(root);

  const render = () => {
    const lines = records.map((record) => {
      const unit = record.trace.unitId ?? record.trace.unitName ?? 'unknown';
      const reason = record.trace.reason ? ` reason=${record.trace.reason}` : '';
      if (record.diffs.length > 0) {
        const diff = record.diffs[0];
        return `${record.trace.kind}:${unit}${reason} ${JSON.stringify(diff.prev)} -> ${JSON.stringify(diff.next)}`;
      }
      return `${record.trace.kind}:${unit}${reason}`;
    });
    list.textContent = lines.join('\n');
  };

  const unsub = inspect({
    scope: options.scope,
    trace: options.trace,
    sampleRate: options.sampleRate,
    onRecord: (record) => {
      records.push(record);
      if (records.length > maxRecords) {
        records.shift();
      }
      render();
    },
  });

  return {
    unsubscribe: unsub,
    clear: () => {
      records.length = 0;
      list.textContent = '';
    },
    destroy: () => {
      unsub();
      root.remove();
    },
    getRecords: () => [...records],
  };
}

// ---------------------------------------------------------------------------
// Dependency graph export
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  kind: 'cell' | 'computed';
  name: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'dependency';
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ExportGraphOptions {
  format?: 'json' | 'dot' | 'mermaid';
}

function getUnitName(unit: { meta?: { id?: string; debugName?: string } }, index: number): string {
  return unit.meta?.debugName ?? unit.meta?.id ?? `unit_${index}`;
}

export function exportDependencyGraph(
  _scope: Scope,
  cells: Cell<any>[],
  computeds: Computed<any>[],
  options: { format: 'dot' | 'mermaid' },
): string;
export function exportDependencyGraph(
  _scope: Scope,
  cells: Cell<any>[],
  computeds: Computed<any>[],
  options?: ExportGraphOptions,
): DependencyGraph;
export function exportDependencyGraph(
  _scope: Scope,
  cells: Cell<any>[],
  computeds: Computed<any>[],
  options?: ExportGraphOptions,
): DependencyGraph | string {
  const format = options?.format ?? 'json';

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const unitNames = new Map<unknown, string>();

  // Register cell nodes
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const name = getUnitName(c, i);
    unitNames.set(c, name);
    nodes.push({ id: c.meta?.id ?? name, kind: 'cell', name });
  }

  // Register computed nodes and edges
  for (let i = 0; i < computeds.length; i++) {
    const comp = computeds[i];
    const name = getUnitName(comp, cells.length + i);
    unitNames.set(comp, name);
    nodes.push({ id: comp.meta?.id ?? name, kind: 'computed', name });

    // Add edges from deps to this computed
    for (const dep of comp.deps) {
      const depName = unitNames.get(dep) ?? getUnitName(dep as Cell<any>, 0);
      edges.push({ from: depName, to: name, type: 'dependency' });
    }
  }

  const graph: DependencyGraph = { nodes, edges };

  if (format === 'dot') {
    const lines = ['digraph {'];
    for (const node of nodes) {
      const shape = node.kind === 'cell' ? 'box' : 'ellipse';
      lines.push(`  "${node.name}" [shape=${shape}];`);
    }
    for (const edge of edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  if (format === 'mermaid') {
    const lines = ['graph TD'];
    for (const edge of edges) {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }
    return lines.join('\n');
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Performance profiling
// ---------------------------------------------------------------------------

export interface SetReport {
  unitId?: string;
  unitName?: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
}

export interface ProfileReport {
  sets: SetReport[];
}

export interface Profiler {
  getReport(): ProfileReport;
  stop(): void;
}

export function profileScope(scope: Scope): Profiler {
  const setStats = new Map<string, { unitId?: string; unitName?: string; count: number; totalMs: number; maxMs: number }>();

  const unsub = scope.subscribe((commit) => {
    const ts = performance.now();
    for (const change of commit.changes) {
      if (change.kind === 'set') {
        const key = change.unit.meta?.id ?? change.unit.meta?.debugName ?? 'unknown';
        let stats = setStats.get(key);
        if (!stats) {
          stats = { unitId: change.unit.meta?.id, unitName: change.unit.meta?.debugName, count: 0, totalMs: 0, maxMs: 0 };
          setStats.set(key, stats);
        }
        stats.count++;
        // Approximate timing per change (batch granularity)
        const elapsed = performance.now() - ts;
        stats.totalMs += elapsed;
        if (elapsed > stats.maxMs) stats.maxMs = elapsed;
      }
    }
  });

  return {
    getReport(): ProfileReport {
      const sets: SetReport[] = [];
      for (const stats of setStats.values()) {
        sets.push({
          unitId: stats.unitId,
          unitName: stats.unitName,
          count: stats.count,
          totalMs: stats.totalMs,
          avgMs: stats.count > 0 ? stats.totalMs / stats.count : 0,
          maxMs: stats.maxMs,
        });
      }
      return { sets };
    },
    stop: unsub,
  };
}

// ---------------------------------------------------------------------------
// Time-travel debugging
// ---------------------------------------------------------------------------

export interface StateSnapshot {
  id: number;
  timestamp: number;
  state: Record<string, unknown>;
}

export interface TimeTravelerOptions {
  maxSnapshots?: number;
}

export interface TimeTraveler {
  getSnapshots(): StateSnapshot[];
  getCurrentIndex(): number;
  stepBack(): void;
  stepForward(): void;
  jumpTo(index: number): void;
  stop(): void;
}

export function createTimeTraveler(scope: Scope, options?: TimeTravelerOptions): TimeTraveler {
  const maxSnapshots = options?.maxSnapshots ?? 100;
  const snapshots: StateSnapshot[] = [];
  let currentIndex = -1;
  let seq = 0;
  let traveling = false;

  const captureSnapshot = (): StateSnapshot => ({
    id: seq++,
    timestamp: Date.now(),
    state: snapshotScope(scope),
  });

  const restoreSnapshot = (snapshot: StateSnapshot) => {
    traveling = true;
    try {
      applySnapshot(scope, snapshot.state, 'time-travel');
    } finally {
      traveling = false;
    }
  };

  const unsub = scope.subscribe(() => {
    if (traveling) return;

    // If we stepped back, discard future snapshots
    if (currentIndex < snapshots.length - 1) {
      snapshots.length = currentIndex + 1;
    }

    const snapshot = captureSnapshot();
    snapshots.push(snapshot);
    if (snapshots.length > maxSnapshots) {
      snapshots.shift();
    }
    currentIndex = snapshots.length - 1;
  });

  return {
    getSnapshots: () => [...snapshots],
    getCurrentIndex: () => currentIndex,
    stepBack() {
      if (currentIndex > 0) {
        currentIndex--;
        restoreSnapshot(snapshots[currentIndex]);
      } else if (currentIndex === 0) {
        // Restore to initial state (before any tracked changes)
        currentIndex = -1;
        // Restore defaults by using empty snapshot with initial values
        const cells = scope.listKnownCells();
        traveling = true;
        try {
          scope.batch(() => {
            for (const c of cells) {
              scope.set(c, c.init);
            }
          });
        } finally {
          traveling = false;
        }
      }
    },
    stepForward() {
      if (currentIndex < snapshots.length - 1) {
        currentIndex++;
        restoreSnapshot(snapshots[currentIndex]);
      }
    },
    jumpTo(index: number) {
      if (index >= 0 && index < snapshots.length) {
        currentIndex = index;
        restoreSnapshot(snapshots[index]);
      }
    },
    stop: unsub,
  };
}

export { createReduxDevtoolsAdapter } from './redux-devtools.js';
export type {
  ReduxDevtoolsAdapter,
  ReduxDevtoolsAdapterOptions,
  ReduxDevtoolsLike,
} from './redux-devtools.js';
