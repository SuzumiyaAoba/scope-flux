import { describe, expect, it, vi } from 'vitest';

import { cell, createStore, event } from '@suzumiyaaoba/scope-flux-core';
import { connectDevtools, createReduxDevtoolsAdapter, inspect } from '../src/index.js';

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
});
