import { describe, expect, it, vi } from 'vitest';

import { cell, createStore, event } from '@scope-flux/core';
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
});
