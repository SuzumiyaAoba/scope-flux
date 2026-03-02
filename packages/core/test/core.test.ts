import { describe, expect, it, vi } from 'vitest';

import { cell, computed, createStore, effect, event, getRegisteredCellById, listRegisteredCells } from '../src/index.js';
import type { Computed } from '../src/index.js';

describe('core', () => {
  it('computed caches until dependency changes', () => {
    const n = cell(1, { id: 'n' });
    let runs = 0;
    const doubled = computed([n], (value) => {
      runs += 1;
      return value * 2;
    });

    const scope = createStore().fork();

    expect(scope.get(doubled)).toBe(2);
    expect(scope.get(doubled)).toBe(2);
    expect(runs).toBe(1);

    scope.set(n, 2);
    expect(scope.get(doubled)).toBe(4);
    expect(runs).toBe(2);
  });

  it('detects computed cycles', () => {
    const scope = createStore().fork();

    const a = computed([] as const, () => 0) as unknown as Computed<number>;
    const b = computed([a], (av) => av + 1);
    (a as unknown as { deps: readonly [typeof b]; read: (bv: number) => number }).deps = [b];
    (a as unknown as { deps: readonly [typeof b]; read: (bv: number) => number }).read = (bv: number) => bv + 1;

    expect(() => scope.get(a)).toThrowError(/NS_CORE_CYCLE_DETECTED/);
  });

  it('batch emits one commit notification', () => {
    const a = cell(0, { id: 'a' });
    const b = cell(0, { id: 'b' });
    const scope = createStore().fork();

    const commits = [] as Array<{ changes: Array<{ kind: string }> }>;
    scope.subscribe((evt) => commits.push(evt));

    scope.batch(() => {
      scope.set(a, 1);
      scope.set(b, 2);
    });

    expect(commits).toHaveLength(1);
    expect(commits[0].changes.filter((x) => x.kind === 'set')).toHaveLength(2);
  });

  it('forked scopes are isolated', () => {
    const count = cell(0, { id: 'count' });
    const store = createStore();
    const s1 = store.fork();
    const s2 = store.fork();

    s1.set(count, 10);

    expect(s1.get(count)).toBe(10);
    expect(s2.get(count)).toBe(0);
  });

  it('event handlers can update state via emit', () => {
    const inc = event<number>({ debugName: 'inc' });
    const count = cell(0, { id: 'event_count' });
    const scope = createStore().fork();

    scope.on(inc, (payload, s) => {
      s.set(count, (prev) => prev + payload);
    });

    scope.emit(inc, 3);
    expect(scope.get(count)).toBe(3);
  });

  it('throws when duplicate stable ids are registered', () => {
    cell(0, { id: 'dup_test_cell_unique' });
    expect(() => cell(1, { id: 'dup_test_cell_unique' })).toThrowError(/NS_CORE_DUPLICATE_STABLE_ID/);
  });

  it('exposes registered cells via registry helpers', () => {
    const registered = cell(7, { id: 'registry_lookup_cell_unique' });

    expect(getRegisteredCellById('registry_lookup_cell_unique')).toBe(registered);
    expect(listRegisteredCells()).toContain(registered);
  });

  it('emits event change even when no handlers are registered', () => {
    const ping = event<number>({ debugName: 'ping_no_handler' });
    const scope = createStore().fork();
    const commits: Array<{ changes: Array<{ kind: string }> }> = [];
    scope.subscribe((evt) => commits.push(evt));

    scope.emit(ping, 1, { reason: 'no_handler' });

    expect(commits).toHaveLength(1);
    expect(commits[0].changes[0].kind).toBe('event');
  });

  it('run rejects when non-effect unit is passed', async () => {
    const scope = createStore().fork();

    await expect(scope.run({ kind: 'event' } as any, 1))
      .rejects
      .toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('get/set reject invalid units', () => {
    const scope = createStore().fork();

    expect(() => scope.get(null as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
    expect(() => scope.set({ kind: 'event' } as any, 1)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('event unsubscribe detaches handler', () => {
    const inc = event<number>({ debugName: 'inc_unsub' });
    const count = cell(0, { id: 'event_unsub_count' });
    const scope = createStore().fork();

    const off = scope.on(inc, (payload, s) => {
      s.set(count, (prev) => prev + payload);
    });

    scope.emit(inc, 2);
    off();
    scope.emit(inc, 3);

    expect(scope.get(count)).toBe(2);
  });

  it('does not emit commit when setting an equal value', () => {
    const count = cell(1, { id: 'no_change_count' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    scope.set(count, 1);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies listeners active at flush start even if unsubscribed during notification', () => {
    const count = cell(0, { id: 'unsubscribe_during_notify_count' });
    const scope = createStore().fork();
    const listenerA = vi.fn();
    const listenerC = vi.fn();

    let unsubscribeA: () => void = () => {};
    const listenerB = vi.fn(() => {
      unsubscribeA();
    });

    unsubscribeA = scope.subscribe(listenerA);
    scope.subscribe(listenerB);
    scope.subscribe(listenerC);

    scope.set(count, 1);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerC).toHaveBeenCalledTimes(1);

    scope.set(count, 2);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);
    expect(listenerC).toHaveBeenCalledTimes(2);
  });

  it('does not notify listeners subscribed during current flush until next flush', () => {
    const count = cell(0, { id: 'subscribe_during_notify_count' });
    const scope = createStore().fork();
    const listenerA = vi.fn();
    const listenerB = vi.fn(() => {
      scope.subscribe(listenerC);
    });
    const listenerC = vi.fn();

    scope.subscribe(listenerA);
    scope.subscribe(listenerB);

    scope.set(count, 1);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerC).toHaveBeenCalledTimes(0);

    scope.set(count, 2);
    expect(listenerA).toHaveBeenCalledTimes(2);
    expect(listenerB).toHaveBeenCalledTimes(2);
    expect(listenerC).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates computed after read throws once', () => {
    const trigger = cell(0, { id: 'computed_throw_recover_trigger' });
    const scope = createStore().fork();
    let shouldThrow = true;
    const unstable = computed([trigger], () => {
      if (shouldThrow) {
        throw new Error('boom');
      }
      return 42;
    });

    expect(() => scope.get(unstable)).toThrowError('boom');
    shouldThrow = false;

    expect(scope.get(unstable)).toBe(42);
  });

  it('computed with cache:none runs read on every get', () => {
    const source = cell(1, { id: 'computed_no_cache_source' });
    const scope = createStore().fork();
    let runs = 0;
    const uncached = computed([source], (value) => {
      runs += 1;
      return value * 10;
    }, { cache: 'none' });

    expect(scope.get(uncached)).toBe(10);
    expect(scope.get(uncached)).toBe(10);
    expect(runs).toBe(2);
  });

  it('unsubscribe is idempotent', () => {
    const count = cell(0, { id: 'unsubscribe_idempotent_count' });
    const scope = createStore().fork();
    const listener = vi.fn();
    const unsub = scope.subscribe(listener);

    unsub();
    unsub();

    scope.set(count, 1);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('event handlers subscribed during emit are called from next emit', () => {
    const ping = event<number>({ debugName: 'subscribe_during_emit_ping' });
    const scope = createStore().fork();
    const late = vi.fn();
    const early = vi.fn(() => {
      scope.on(ping, late);
    });
    scope.on(ping, early);

    scope.emit(ping, 1);
    expect(early).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(0);

    scope.emit(ping, 2);
    expect(early).toHaveBeenCalledTimes(2);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('batch flushes committed changes even when callback throws', () => {
    const count = cell(0, { id: 'batch_throw_count' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    expect(() => {
      scope.batch(() => {
        scope.set(count, 1);
        throw new Error('batch_fail');
      });
    }).toThrowError('batch_fail');

    expect(scope.get(count)).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    const commit = listener.mock.calls[0][0] as { changes: Array<{ kind: string }> };
    expect(commit.changes.filter((x) => x.kind === 'set')).toHaveLength(1);
  });

  it('custom equal controls whether update emits commit', () => {
    const eq = vi.fn((a: number, b: number) => Math.abs(a - b) < 2);
    const count = cell<number>(0, { id: 'custom_equal_count', equal: eq });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    scope.set(count, 1);
    expect(scope.get(count)).toBe(0);
    expect(listener).toHaveBeenCalledTimes(0);

    scope.set(count, 3);
    expect(scope.get(count)).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('run emits effect commit with reason and priority before handler resolution', async () => {
    const count = cell(0, { id: 'effect_commit_order_count' });
    const scope = createStore().fork();
    const commits: Array<{ priority: string; changes: Array<{ kind: string; reason?: string }> }> = [];
    scope.subscribe((evt) => commits.push(evt as any));

    const fx = effect<number, number>(async (payload, { scope: s }) => {
      s.set(count, payload);
      return payload * 2;
    });

    const result = await scope.run(fx, 5, { priority: 'idle', reason: 'fx_reason' });
    expect(result).toBe(10);
    expect(scope.get(count)).toBe(5);
    expect(commits).toHaveLength(2);
    expect(commits[0].priority).toBe('idle');
    expect(commits[0].changes[0].kind).toBe('effect');
    expect(commits[0].changes[0].reason).toBe('fx_reason');
    expect(commits[1].changes[0].kind).toBe('set');
  });

  it('supports seed for createStore and fork and rejects invalid seed', () => {
    const count = cell(0, { id: 'seed_count' });
    const store = createStore({ seed: new Map([[count, 10]]) });
    const seededRoot = store.root;
    const seededFork = store.fork([[count, 20]]);
    const plainFork = store.fork();

    expect(seededRoot.get(count)).toBe(10);
    expect(seededFork.get(count)).toBe(20);
    expect(plainFork.get(count)).toBe(0);

    expect(() => createStore({ seed: 123 as any })).toThrowError(/NS_CORE_INVALID_UPDATE/);
    expect(() => store.fork(123 as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });
});
