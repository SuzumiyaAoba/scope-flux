import { describe, expect, it, vi } from 'vitest';

import { cell, computed, createStore, event } from '@suzumiyaaoba/scope-flux-core';
import { connectDevtools, createReduxDevtoolsAdapter, createTimeTraveler, enableHMR, exportDependencyGraph, inspect, mountInspectPanel, profileScope } from '../src/index.js';

describe('inspect', () => {
  it('captures set diffs as inspect records', () => {
    const count = cell(0, { id: 'inspect_count', debugName: 'count' });
    const scope = createStore().fork();
    const records: Array<{ diffs: Array<{ prev: unknown; next: unknown }> }> = [];

    const unsub = inspect({
      scope,
      trace: true,
      onRecord: (record) => {
        records.push(record as any);
      },
    });

    scope.set(count, 2);
    unsub();

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].diffs[0].prev).toBe(0);
    expect(records[0].diffs[0].next).toBe(2);
  });

  it('can skip sampling when sampleRate is zero', () => {
    const count = cell(0, { id: 'inspect_sample_count' });
    const scope = createStore().fork();

    const onRecord = vi.fn();
    const unsub = inspect({
      scope,
      sampleRate: 0,
      onRecord,
    });

    scope.set(count, 3);
    unsub();

    expect(onRecord).not.toHaveBeenCalled();
  });

  it('clamps sampleRate greater than one to one', () => {
    const count = cell(0, { id: 'inspect_sample_clamp_count' });
    const scope = createStore().fork();
    const onRecord = vi.fn();

    const unsub = inspect({
      scope,
      sampleRate: 3,
      onRecord,
    });
    scope.set(count, 1);
    unsub();

    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it('skips records when random value is above sampleRate', () => {
    const count = cell(0, { id: 'inspect_sample_random_count' });
    const scope = createStore().fork();
    const onRecord = vi.fn();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    try {
      const unsub = inspect({
        scope,
        sampleRate: 0.5,
        onRecord,
      });

      scope.set(count, 1);
      unsub();
    } finally {
      randomSpy.mockRestore();
    }

    expect(onRecord).not.toHaveBeenCalled();
  });

  it('connectDevtools initializes and sends updates', () => {
    const count = cell(0, { id: 'inspect_devtools_count' });
    const ping = event<number>({ debugName: 'ping' });
    const scope = createStore().fork();

    scope.on(ping, (payload, s) => {
      s.set(count, (prev) => prev + payload);
    });

    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
    };

    const unsub = connectDevtools({
      scope,
      adapter,
      trace: true,
    });

    scope.emit(ping, 5);
    unsub();

    expect(adapter.init).toHaveBeenCalledTimes(1);
    expect(adapter.send).toHaveBeenCalled();

    const latestState = adapter.send.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(latestState.inspect_devtools_count).toBe(5);
  });

  it('redux devtools adapter forwards calls when extension exists', () => {
    const init = vi.fn();
    const send = vi.fn();
    const unsubscribe = vi.fn();

    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init,
          send,
          unsubscribe,
        }),
      },
      name: 'scope-flux-test',
    });

    adapter.init({ a: 1 });
    adapter.send({ type: 'set:x' }, { x: 2 });
    adapter.disconnect();

    expect(init).toHaveBeenCalledWith({ a: 1 });
    expect(send).toHaveBeenCalledWith({ type: 'set:x' }, { x: 2 });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('redux devtools adapter becomes no-op when extension is missing', () => {
    const adapter = createReduxDevtoolsAdapter({ extension: undefined });

    expect(() => adapter.init({})).not.toThrow();
    expect(() => adapter.send({ type: 'x' }, {})).not.toThrow();
    expect(() => adapter.disconnect()).not.toThrow();
  });

  it('connectDevtools applies jump_to_state from adapter subscription', () => {
    const count = cell(0, { id: 'inspect_jump_count' });
    const scope = createStore().fork();
    scope.registerCell(count);
    let receive!: (message: { type: 'jump_to_state'; state: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'jump_to_state'; state: unknown }) => void) => {
        receive = listener;
        return () => {
          // no-op
        };
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    receive({ type: 'jump_to_state', state: { inspect_jump_count: 7 } });

    expect(scope.get(count)).toBe(7);
    unsub();
  });

  it('connectDevtools applies jump_to_state by debugName when id is missing', () => {
    const byName = cell(0, { debugName: 'debug_only_cell' });
    const scope = createStore().fork();
    scope.registerCell(byName);
    let receive!: (message: { type: 'jump_to_state'; state: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'jump_to_state'; state: unknown }) => void) => {
        receive = listener;
        return () => {
          // no-op
        };
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    receive({ type: 'jump_to_state', state: { debug_only_cell: 4 } });
    expect(scope.get(byName)).toBe(4);
    unsub();
  });

  it('connectDevtools resolves cell via resolveUnit before id/debugName fallback', () => {
    const target = cell(0, { id: 'inspect_resolve_target', debugName: 'resolve_target' });
    const distractor = cell(0, { id: 'inspect_resolve_key', debugName: 'inspect_resolve_key' });
    const scope = createStore().fork();
    scope.registerCell(target);
    scope.registerCell(distractor);
    let receive!: (message: { type: 'jump_to_state'; state: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'jump_to_state'; state: unknown }) => void) => {
        receive = listener;
        return () => {};
      },
    };

    const unsub = connectDevtools({
      scope,
      adapter,
      resolveUnit: (key) => (key === 'inspect_resolve_key' ? target : undefined),
    });
    receive({ type: 'jump_to_state', state: { inspect_resolve_key: 9 } });

    expect(scope.get(target)).toBe(9);
    expect(scope.get(distractor)).toBe(0);
    unsub();
  });

  it('connectDevtools falls back to id/debugName when resolveUnit returns undefined', () => {
    const count = cell(0, { id: 'inspect_resolve_fallback' });
    const scope = createStore().fork();
    scope.registerCell(count);
    let receive!: (message: { type: 'jump_to_state'; state: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'jump_to_state'; state: unknown }) => void) => {
        receive = listener;
        return () => {};
      },
    };

    const unsub = connectDevtools({
      scope,
      adapter,
      resolveUnit: () => undefined,
    });
    receive({ type: 'jump_to_state', state: { inspect_resolve_fallback: 6 } });
    expect(scope.get(count)).toBe(6);
    unsub();
  });

  it('connectDevtools reset applies provided snapshot', () => {
    const count = cell(5, { id: 'inspect_reset_count' });
    const scope = createStore().fork();
    let receive!: (message: { type: 'reset'; state?: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'reset'; state?: unknown }) => void) => {
        receive = listener;
        return () => {
          // no-op
        };
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    scope.set(count, 10);
    expect(scope.get(count)).toBe(10);

    receive({ type: 'reset', state: { inspect_reset_count: 5 } });
    expect(scope.get(count)).toBe(5);
    unsub();
  });

  it('redux devtools adapter normalizes DISPATCH JUMP_TO_STATE', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.({
      type: 'DISPATCH',
      payload: { type: 'JUMP_TO_STATE' },
      state: '{"count":2}',
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'jump_to_state',
      state: { count: 2 },
      nextLiftedState: undefined,
    });
  });

  it('redux devtools adapter normalizes DISPATCH IMPORT_STATE with lifted state', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.({
      type: 'DISPATCH',
      payload: {
        type: 'IMPORT_STATE',
        nextLiftedState: '{"computedStates":[{"state":{"inspect_import_count":8}}]}',
      },
      state: '{"inspect_import_count":1}',
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'import_state',
      state: { inspect_import_count: 1 },
      nextLiftedState: { computedStates: [{ state: { inspect_import_count: 8 } }] },
    });
  });

  it('redux devtools adapter normalizes STATE message', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.({
      type: 'STATE',
      state: '{"count":3}',
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'jump_to_state',
      state: { count: 3 },
      nextLiftedState: undefined,
    });
  });

  it('redux devtools adapter normalizes ACTION payload message', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.({
      type: 'ACTION',
      payload: '{"type":"reset","state":{"count":0}}',
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'reset',
      state: { count: 0 },
      nextLiftedState: undefined,
    });
  });

  it('redux devtools adapter forwards lowercase message as-is', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.({
      type: 'rollback',
      state: '{"count":4}',
      nextLiftedState: '{"x":1}',
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'rollback',
      state: { count: 4 },
      nextLiftedState: { x: 1 },
    });
  });

  it('redux devtools adapter subscribe returns no-op when extension does not provide subscribe', () => {
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
        }),
      },
    });

    expect(() => adapter.subscribe?.(() => {})).not.toThrow();
  });

  it('redux devtools adapter ignores non-object and unsupported messages', () => {
    let forwarded: ((message: unknown) => void) | undefined;
    const adapter = createReduxDevtoolsAdapter({
      extension: {
        connect: () => ({
          init: () => {},
          send: () => {},
          subscribe: (listener) => {
            forwarded = listener as typeof forwarded;
            return () => {};
          },
        }),
      },
    });

    const onMessage = vi.fn();
    adapter.subscribe?.(onMessage);
    forwarded?.('not-an-object');
    forwarded?.({
      type: 'DISPATCH',
      payload: { type: 'UNKNOWN_ACTION' },
      state: '{}',
    });
    forwarded?.({
      type: 'ACTION',
      payload: '{"type":"unknown_action"}',
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('connectDevtools reports adapter errors via onError', () => {
    const count = cell(0, { id: 'inspect_on_error_count' });
    const scope = createStore().fork();
    const onError = vi.fn();
    const adapter = {
      init: () => {
        throw new Error('init_fail');
      },
      send: () => {
        throw new Error('send_fail');
      },
    };

    const unsub = connectDevtools({
      scope,
      adapter,
      onError,
    });

    scope.set(count, 1);
    expect(onError).toHaveBeenCalled();
    unsub();
  });

  it('connectDevtools reports unsupported inbound message', () => {
    const scope = createStore().fork();
    let receive!: (message: { type: 'import_state'; state?: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'import_state'; state?: unknown }) => void) => {
        receive = listener;
        return () => {};
      },
    };
    const onUnsupportedMessage = vi.fn();
    const unsub = connectDevtools({
      scope,
      adapter,
      onUnsupportedMessage,
    });
    receive({ type: 'import_state', state: 'invalid' });
    expect(onUnsupportedMessage).toHaveBeenCalled();
    unsub();
  });

  it('connectDevtools import_state applies latest computedStates snapshot', () => {
    const count = cell(0, { id: 'inspect_import_apply_count' });
    const scope = createStore().fork();
    scope.registerCell(count);
    let receive!: (message: { type: 'import_state'; nextLiftedState?: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: { type: 'import_state'; nextLiftedState?: unknown }) => void) => {
        receive = listener;
        return () => {};
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    receive({
      type: 'import_state',
      nextLiftedState: {
        computedStates: [
          { state: { inspect_import_apply_count: 3 } },
          { state: { inspect_import_apply_count: 9 } },
        ],
      },
    });
    expect(scope.get(count)).toBe(9);
    unsub();
  });

  it('connectDevtools handles adapter.send() throwing repeatedly', () => {
    const count = cell(0, { id: 'inspect_send_error_count' });
    const scope = createStore().fork();
    const onError = vi.fn();
    let sendCallCount = 0;
    const adapter = {
      init: vi.fn(),
      send: () => {
        sendCallCount++;
        throw new Error(`send_fail_${sendCallCount}`);
      },
    };

    const unsub = connectDevtools({ scope, adapter, onError });
    scope.set(count, 1);
    scope.set(count, 2);

    expect(onError).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('connectDevtools works with send-only adapter (no subscribe)', () => {
    const count = cell(0, { id: 'inspect_send_only_count' });
    const scope = createStore().fork();
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
    };

    const unsub = connectDevtools({ scope, adapter });
    scope.set(count, 1);

    expect(adapter.send).toHaveBeenCalled();
    unsub();
  });

  it('inspect with trace=false omits parentId', () => {
    const count = cell(0, { id: 'inspect_no_trace_count' });
    const scope = createStore().fork();
    const records: any[] = [];

    const unsub = inspect({
      scope,
      trace: false,
      onRecord: (record) => records.push(record),
    });

    scope.set(count, 1);
    unsub();

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].trace.parentId).toBeUndefined();
  });

  it('inspect captures event records with empty diffs', () => {
    const ping = event<number>({ debugName: 'inspect_event_diff_ping' });
    const scope = createStore().fork();
    const records: any[] = [];

    const unsub = inspect({
      scope,
      onRecord: (record) => records.push(record),
    });

    scope.emit(ping, 42);
    unsub();

    const eventRecords = records.filter((r: any) => r.trace.kind === 'event');
    expect(eventRecords.length).toBeGreaterThan(0);
    expect(eventRecords[0].diffs).toHaveLength(0);
  });

  it('connectDevtools applies jump_to_action like jump_to_state', () => {
    const count = cell(0, { id: 'inspect_jump_action_count' });
    const scope = createStore().fork();
    scope.registerCell(count);
    let receive!: (message: { type: string; state?: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: any) => void) => {
        receive = listener;
        return () => {};
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    receive({ type: 'jump_to_action', state: { inspect_jump_action_count: 12 } });
    expect(scope.get(count)).toBe(12);
    unsub();
  });

  it('applySnapshot skips keys that match no registered cell', () => {
    const count = cell(0, { id: 'inspect_snapshot_unknown_count' });
    const scope = createStore().fork();
    scope.registerCell(count);
    let receive!: (message: { type: string; state?: unknown }) => void;
    const adapter = {
      init: vi.fn(),
      send: vi.fn(),
      subscribe: (listener: (message: any) => void) => {
        receive = listener;
        return () => {};
      },
    };

    const unsub = connectDevtools({ scope, adapter });
    receive({
      type: 'jump_to_state',
      state: {
        inspect_snapshot_unknown_count: 5,
        nonexistent_key: 99,
      },
    });
    expect(scope.get(count)).toBe(5);
    unsub();
  });

  it('mountInspectPanel renders incoming records', () => {
    const count = cell(0, { id: 'inspect_panel_count' });
    const scope = createStore().fork();
    const originalDocument = (globalThis as { document?: unknown }).document;

    const makeElement = () => {
      const children: any[] = [];
      return {
        className: '',
        textContent: '',
        innerHTML: '',
        children,
        appendChild(node: unknown) {
          children.push(node);
          return node;
        },
        remove: vi.fn(),
      };
    };

    const target = makeElement();
    (globalThis as { document?: unknown }).document = {
      createElement: () => makeElement(),
      body: target,
    };

    try {
      const panel = mountInspectPanel({ scope, target });
      scope.set(count, 1, { reason: 'panel_test' });

      const records = panel.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].trace.reason).toBe('panel_test');

      panel.clear();
      expect(panel.getRecords()).toHaveLength(0);
      panel.destroy();
    } finally {
      (globalThis as { document?: unknown }).document = originalDocument;
    }
  });

  describe('exportDependencyGraph', () => {
    it('exports nodes and edges for cells and computed', () => {
      const a = cell(1, { id: 'graph_a', debugName: 'a' });
      const b = cell(2, { id: 'graph_b', debugName: 'b' });
      const sum = computed([a, b], (x, y) => x + y, { debugName: 'sum' });

      const scope = createStore().fork();
      // Access computed to register it
      scope.get(sum);

      const graph = exportDependencyGraph(scope, [a, b], [sum]);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2);

      const nodeIds = graph.nodes.map((n) => n.name);
      expect(nodeIds).toContain('a');
      expect(nodeIds).toContain('b');
      expect(nodeIds).toContain('sum');

      // Edges from a -> sum and b -> sum
      for (const edge of graph.edges) {
        expect(edge.to).toBe('sum');
        expect(['a', 'b']).toContain(edge.from);
      }
    });

    it('exports in DOT format', () => {
      const a = cell(1, { id: 'graph_dot_a', debugName: 'a' });
      const doubled = computed([a], (v) => v * 2, { debugName: 'doubled' });

      const scope = createStore().fork();
      scope.get(doubled);

      const dot = exportDependencyGraph(scope, [a], [doubled], { format: 'dot' });

      expect(typeof dot).toBe('string');
      expect(dot).toContain('digraph');
      expect(dot).toContain('a');
      expect(dot).toContain('doubled');
    });

    it('exports in mermaid format', () => {
      const a = cell(1, { id: 'graph_mermaid_a', debugName: 'a' });
      const doubled = computed([a], (v) => v * 2, { debugName: 'doubled' });

      const scope = createStore().fork();
      scope.get(doubled);

      const mermaid = exportDependencyGraph(scope, [a], [doubled], { format: 'mermaid' });

      expect(typeof mermaid).toBe('string');
      expect(mermaid).toContain('graph TD');
    });
  });

  describe('profileScope', () => {
    it('tracks set operations', () => {
      const a = cell(0, { id: 'prof_a', debugName: 'a' });
      const scope = createStore().fork();

      const profiler = profileScope(scope);

      scope.set(a, 1);
      scope.set(a, 2);
      scope.set(a, 3);

      const report = profiler.getReport();
      profiler.stop();

      expect(report.sets.length).toBeGreaterThan(0);
      const aReport = report.sets.find((s) => s.unitName === 'a');
      expect(aReport).toBeDefined();
      expect(aReport!.count).toBe(3);
    });

    it('tracks computed evaluation timing', () => {
      const a = cell(1, { id: 'prof_comp_a', debugName: 'a' });
      const doubled = computed([a], (v) => v * 2, { debugName: 'doubled' });

      const scope = createStore().fork();
      const profiler = profileScope(scope);

      scope.get(doubled);
      scope.set(a, 2);
      scope.get(doubled);

      const report = profiler.getReport();
      profiler.stop();

      expect(report.sets.length).toBeGreaterThan(0);
    });

    it('stops tracking after stop()', () => {
      const a = cell(0, { id: 'prof_stop_a', debugName: 'a' });
      const scope = createStore().fork();

      const profiler = profileScope(scope);
      scope.set(a, 1);
      profiler.stop();
      scope.set(a, 2);

      const report = profiler.getReport();
      const aReport = report.sets.find((s) => s.unitName === 'a');
      expect(aReport!.count).toBe(1);
    });
  });

  describe('createTimeTraveler', () => {
    it('captures snapshots on each commit', () => {
      const a = cell(0, { id: 'tt_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope);

      scope.set(a, 1);
      scope.set(a, 2);
      scope.set(a, 3);

      const snapshots = traveler.getSnapshots();
      expect(snapshots.length).toBe(3);
      traveler.stop();
    });

    it('stepBack restores previous state', () => {
      const a = cell(0, { id: 'tt_step_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope);

      scope.set(a, 10);
      scope.set(a, 20);

      traveler.stepBack();
      expect(scope.get(a)).toBe(10);

      traveler.stepBack();
      expect(scope.get(a)).toBe(0);

      traveler.stop();
    });

    it('stepForward restores next state', () => {
      const a = cell(0, { id: 'tt_fwd_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope);

      scope.set(a, 10);
      scope.set(a, 20);

      traveler.stepBack();
      traveler.stepBack();
      expect(scope.get(a)).toBe(0);

      traveler.stepForward();
      expect(scope.get(a)).toBe(10);

      traveler.stepForward();
      expect(scope.get(a)).toBe(20);

      traveler.stop();
    });

    it('jumpTo restores specific snapshot', () => {
      const a = cell(0, { id: 'tt_jump_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope);

      scope.set(a, 100);
      scope.set(a, 200);
      scope.set(a, 300);

      traveler.jumpTo(0);
      expect(scope.get(a)).toBe(100);

      traveler.jumpTo(2);
      expect(scope.get(a)).toBe(300);

      traveler.stop();
    });

    it('respects maxSnapshots limit', () => {
      const a = cell(0, { id: 'tt_max_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope, { maxSnapshots: 3 });

      scope.set(a, 1);
      scope.set(a, 2);
      scope.set(a, 3);
      scope.set(a, 4);
      scope.set(a, 5);

      const snapshots = traveler.getSnapshots();
      expect(snapshots.length).toBe(3);
      traveler.stop();
    });

    it('getCurrentIndex returns current position', () => {
      const a = cell(0, { id: 'tt_idx_a', debugName: 'a' });
      const scope = createStore().fork();

      const traveler = createTimeTraveler(scope);

      scope.set(a, 1);
      scope.set(a, 2);

      expect(traveler.getCurrentIndex()).toBe(1);

      traveler.stepBack();
      expect(traveler.getCurrentIndex()).toBe(0);

      traveler.stop();
    });
  });

  describe('enableHMR', () => {
    it('preserves state across simulated HMR dispose/accept cycle', () => {
      const a = cell(10, { id: 'hmr_a' });
      const b = cell(20, { id: 'hmr_b' });

      const scope = createStore().fork();
      scope.set(a, 42);
      scope.set(b, 99);

      // Simulate HMR hot module interface
      let disposeCallback: ((data: Record<string, unknown>) => void) | null = null;
      const hotData: Record<string, unknown> = {};

      const hot = {
        data: hotData,
        dispose(cb: (data: Record<string, unknown>) => void) {
          disposeCallback = cb;
        },
        accept() {},
      };

      enableHMR(scope, hot);

      // Simulate module dispose (HMR teardown)
      disposeCallback!(hotData);

      // hotData should now contain serialized state
      expect(hotData.__scopeFluxHMR).toBeDefined();

      // Simulate new module load — create new scope with same cells
      const newScope = createStore().fork();
      // New scope has defaults
      expect(newScope.get(a)).toBe(10);
      expect(newScope.get(b)).toBe(20);

      // Re-enable HMR with the preserved data
      const hotAfter = {
        data: hotData,
        dispose(_cb: (data: Record<string, unknown>) => void) {},
        accept() {},
      };

      enableHMR(newScope, hotAfter);

      // State should be restored
      expect(newScope.get(a)).toBe(42);
      expect(newScope.get(b)).toBe(99);
    });

    it('respects exclude option', () => {
      const a = cell(10, { id: 'hmr_exc_a' });
      const ephemeral = cell('temp', { id: 'hmr_exc_eph' });

      const scope = createStore().fork();
      scope.set(a, 42);
      scope.set(ephemeral, 'modified');

      let disposeCallback: ((data: Record<string, unknown>) => void) | null = null;
      const hotData: Record<string, unknown> = {};

      const hot = {
        data: hotData,
        dispose(cb: (data: Record<string, unknown>) => void) { disposeCallback = cb; },
        accept() {},
      };

      enableHMR(scope, hot, { exclude: [ephemeral] });
      disposeCallback!(hotData);

      // Restore into new scope
      const newScope = createStore().fork();
      const hotAfter = {
        data: hotData,
        dispose(_cb: (data: Record<string, unknown>) => void) {},
        accept() {},
      };

      enableHMR(newScope, hotAfter, { exclude: [ephemeral] });

      expect(newScope.get(a)).toBe(42);
      expect(newScope.get(ephemeral)).toBe('temp'); // Not restored — kept default
    });
  });
});
