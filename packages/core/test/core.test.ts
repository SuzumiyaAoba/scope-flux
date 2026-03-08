import { describe, expect, it, vi } from 'vitest';

import {
  asValue,
  cell,
  combine,
  computed,
  createHistoryController,
  createStore,
  effect,
  event,
  cellFamily,
  computedFamily,
  debounce,
  effectFamily,
  eventFamily,
  guard,
  merge,
  sample,
  split,
  throttle,
} from '../src/index.js';
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

  it('throws when duplicate stable ids are registered in the same store', () => {
    const duplicateId = `dup_test_cell_unique_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const first = cell(0, { id: duplicateId });
    const second = cell(1, { id: duplicateId });
    const scope = createStore().fork();

    scope.set(first, 1);
    expect(() => scope.set(second, 2)).toThrowError(/NS_CORE_DUPLICATE_STABLE_ID/);
  });

  it('exposes registered cells via store registry helpers', () => {
    const registered = cell(7, { id: 'registry_lookup_cell_unique' });
    const store = createStore();
    const scope = store.fork();
    scope.get(registered);

    expect(store.getRegisteredCellById('registry_lookup_cell_unique')).toBe(registered);
    expect(store.listRegisteredCells()).toContain(registered);
  });

  it('supports unregister and clear for store registry', () => {
    const first = cell(1, { id: 'registry_cleanup_first' });
    const second = cell(2, { id: 'registry_cleanup_second' });
    const store = createStore();
    const scope = store.fork();
    scope.get(first);
    scope.get(second);

    expect(store.getRegisteredCellById('registry_cleanup_first')).toBe(first);
    expect(store.getRegisteredCellById('registry_cleanup_second')).toBe(second);
    expect(store.unregisterCellById('registry_cleanup_first')).toBe(true);
    expect(store.getRegisteredCellById('registry_cleanup_first')).toBeUndefined();
    expect(store.unregisterCellById('registry_cleanup_first')).toBe(false);

    store.clearRegisteredCells();
    expect(store.getRegisteredCellById('registry_cleanup_second')).toBeUndefined();
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

  it('batch rolls back changes when callback throws', () => {
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

    expect(scope.get(count)).toBe(0);
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('emit rollback does not commit event when handler throws', () => {
    const ping = event<void>({ debugName: 'emit_rollback_ping' });
    const count = cell(0, { id: 'emit_rollback_count' });
    const scope = createStore().fork();
    const commits: Array<{ changes: Array<{ kind: string }> }> = [];
    scope.subscribe((evt) => commits.push(evt as any));
    scope.on(ping, (_payload, s) => {
      s.set(count, 1);
      throw new Error('emit_failed');
    });

    expect(() => scope.emit(ping, undefined)).toThrowError('emit_failed');
    expect(scope.get(count)).toBe(0);
    expect(commits).toHaveLength(0);
  });

  it('batch rollback restores version when same cell is set multiple times', () => {
    const count = cell(0, { id: 'batch_multi_set_rollback_count' });
    const scope = createStore().fork();
    const doubled = computed([count], (v) => v * 2);

    expect(() => {
      scope.batch(() => {
        scope.set(count, 1);
        scope.set(count, 2);
        throw new Error('rollback_multi_set');
      });
    }).toThrowError('rollback_multi_set');

    expect(scope.get(count)).toBe(0);
    expect(scope.get(doubled)).toBe(0);

    scope.set(count, 1);
    expect(scope.get(doubled)).toBe(2);
  });

  it('nested batch rollback restores only failed inner operations', () => {
    const count = cell(0, { id: 'batch_nested_rollback_count' });
    const scope = createStore().fork();

    scope.batch(() => {
      scope.set(count, 1);
      expect(() => {
        scope.batch(() => {
          scope.set(count, 2);
          scope.set(count, 3);
          throw new Error('nested_rollback');
        });
      }).toThrowError('nested_rollback');
    });

    expect(scope.get(count)).toBe(1);
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

  it('set treats function value as value for function cells', () => {
    const fnCell = cell<() => number>(() => 1, { id: 'function_cell_value' });
    const scope = createStore().fork();
    const nextFn = () => 7;

    scope.set(fnCell, nextFn);
    expect(scope.get(fnCell)).toBe(nextFn);
    expect(scope.get(fnCell)()).toBe(7);
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
    expect(plainFork.get(count)).toBe(10);

    expect(() => createStore({ seed: 123 as any })).toThrowError(/NS_CORE_INVALID_UPDATE/);
    expect(() => store.fork(123 as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('batch rollback deletes cell state when cell was first set inside the batch', () => {
    const fresh = cell(0, { id: 'batch_rollback_fresh_cell' });
    const scope = createStore().fork();

    expect(() => {
      scope.batch(() => {
        scope.set(fresh, 99);
        throw new Error('rollback_fresh');
      });
    }).toThrowError('rollback_fresh');

    expect(scope.get(fresh)).toBe(0);
  });

  it('computed restores cached value and version when re-evaluation throws', () => {
    const trigger = cell(0, { id: 'computed_restore_cache_trigger' });
    const scope = createStore().fork();
    let shouldThrow = false;
    const derived = computed([trigger], (v) => {
      if (shouldThrow) {
        throw new Error('recompute_fail');
      }
      return v * 10;
    });

    expect(scope.get(derived)).toBe(0);

    scope.set(trigger, 1);
    shouldThrow = true;

    expect(() => scope.get(derived)).toThrowError('recompute_fail');

    shouldThrow = false;
    expect(scope.get(derived)).toBe(10);
  });

  it('get rejects unit with unknown kind', () => {
    const scope = createStore().fork();
    expect(() => scope.get({ kind: 'unknown', meta: {} } as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('effect with drop policy rejects overlapping run', async () => {
    const scope = createStore().fork();
    let release!: () => void;
    const blocker = new Promise<number>((resolve) => {
      release = () => resolve(1);
    });
    const fx = effect<void, number>(() => blocker, {
      policy: { concurrency: 'drop' },
    });

    const first = scope.run(fx, undefined);
    await expect(scope.run(fx, undefined)).rejects.toThrowError(/NS_CORE_EFFECT_DROPPED/);
    release();
    await expect(first).resolves.toBe(1);
  });

  it('effect with queue policy runs in order', async () => {
    const scope = createStore().fork();
    const seen: number[] = [];
    const fx = effect<number, number>(async (payload) => {
      seen.push(payload);
      await Promise.resolve();
      return payload;
    }, {
      policy: { concurrency: 'queue' },
    });

    const p1 = scope.run(fx, 1);
    const p2 = scope.run(fx, 2);
    const p3 = scope.run(fx, 3);
    await expect(Promise.all([p1, p2, p3])).resolves.toEqual([1, 2, 3]);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('effect with replace policy aborts previous run and resolves latest run', async () => {
    const scope = createStore().fork();
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let calls = 0;
    const fx = effect<void, number>(() => {
      calls += 1;
      return new Promise<number>((resolve) => {
        if (calls === 1) {
          releaseFirst = () => resolve(1);
          return;
        }
        releaseSecond = () => resolve(2);
      });
    }, {
      policy: { concurrency: 'replace' },
    });

    const p1 = scope.run(fx, undefined);
    await Promise.resolve();
    const p2 = scope.run(fx, undefined);
    releaseFirst();
    releaseSecond();

    await expect(p1).rejects.toThrowError(/NS_CORE_EFFECT_REPLACED/);
    await expect(p2).resolves.toBe(2);
  });

  it('effect retries and exposes status', async () => {
    const scope = createStore().fork();
    let attempt = 0;
    const fx = effect<void, number>(() => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error('retry_me');
      }
      return 10;
    }, {
      policy: { retries: 2 },
    });

    await expect(scope.run(fx, undefined)).resolves.toBe(10);
    const status = scope.getEffectStatus(fx);
    expect(status.running).toBe(0);
    expect(status.lastResult).toBe(10);
    expect(status.lastError).toBeUndefined();
  });

  it('effect retryDelayMs function receives attempt and error', async () => {
    const scope = createStore().fork();
    vi.useFakeTimers();
    try {
      let attempt = 0;
      const retryDelay = vi.fn<(attempt: number, error: unknown) => number>((_attempt, _error) => 25);
      const fx = effect<void, number>(() => {
        attempt += 1;
        if (attempt < 2) {
          throw new Error('retry_once');
        }
        return 5;
      }, {
        policy: { retries: 1, retryDelayMs: retryDelay },
      });

      const runPromise = scope.run(fx, undefined);
      await vi.runAllTimersAsync();
      await expect(runPromise).resolves.toBe(5);
      expect(retryDelay).toHaveBeenCalledTimes(1);
      const [callAttempt, callError] = retryDelay.mock.calls[0];
      expect(callAttempt).toBe(1);
      expect(callError).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelEffect aborts running and queued tasks', async () => {
    const scope = createStore().fork();
    let release!: () => void;
    const fx = effect<number, number>(() => {
      return new Promise<number>((resolve) => {
        release = () => resolve(42);
      });
    }, {
      policy: { concurrency: 'queue' },
    });

    const p1 = scope.run(fx, 1);
    const p2 = scope.run(fx, 2);
    scope.cancelEffect(fx);
    release();

    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('subscribeUnit listens only to the target cell', () => {
    const a = cell(0, { id: 'unit_sub_a' });
    const b = cell(0, { id: 'unit_sub_b' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribeUnit(a, listener);

    scope.set(b, 1);
    expect(listener).toHaveBeenCalledTimes(0);
    scope.set(a, 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribeUnit for computed ignores unrelated cell updates', () => {
    const a = cell(1, { id: 'unit_sub_computed_a' });
    const b = cell(1, { id: 'unit_sub_computed_b' });
    const doubledA = computed([a], (v) => v * 2);
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribeUnit(doubledA, listener);

    scope.set(b, 2);
    expect(listener).toHaveBeenCalledTimes(0);

    scope.set(a, 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('run can abort even when effect handler does not use signal', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(() => {
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(10), 30);
      });
    });

    await expect(
      scope.run(fx, undefined, { timeoutMs: 5 })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('subscribeEffectStatus receives updates for run lifecycle', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 1);
    const listener = vi.fn();
    scope.subscribeEffectStatus(fx, listener);

    await scope.run(fx, undefined);

    expect(listener).toHaveBeenCalled();
    const status = scope.getEffectStatus(fx);
    expect(status.running).toBe(0);
    expect(status.lastResult).toBe(1);
  });

  it('history controller supports undo/redo', () => {
    const count = cell(0, { id: 'history_count' });
    const scope = createStore().fork();
    const history = createHistoryController(scope);

    scope.set(count, 1);
    scope.set(count, 2);
    expect(scope.get(count)).toBe(2);
    expect(history.canUndo()).toBe(true);

    expect(history.undo()).toBe(true);
    expect(scope.get(count)).toBe(1);
    expect(history.undo()).toBe(true);
    expect(scope.get(count)).toBe(0);
    expect(history.undo()).toBe(false);

    expect(history.redo()).toBe(true);
    expect(scope.get(count)).toBe(1);
    expect(history.redo()).toBe(true);
    expect(scope.get(count)).toBe(2);
    expect(history.redo()).toBe(false);
  });

  it('history controller can limit tracked cells and stack size', () => {
    const count = cell(0, { id: 'history_tracked_count' });
    const other = cell(0, { id: 'history_tracked_other' });
    const scope = createStore().fork();
    const history = createHistoryController(scope, { track: [count], limit: 1 });

    scope.set(other, 1);
    expect(history.canUndo()).toBe(false);

    scope.set(count, 1);
    scope.set(count, 2);
    expect(history.getSize().undo).toBe(1);

    expect(history.undo()).toBe(true);
    expect(scope.get(count)).toBe(1);
  });

  it('batch rollback removes newly registered cells from the registry', () => {
    const store = createStore();
    const scope = store.root;

    const newCell = cell(0, { id: 'batch_rollback_registry_cell' });

    expect(store.getRegisteredCellById('batch_rollback_registry_cell')).toBeUndefined();

    expect(() => {
      scope.batch(() => {
        scope.set(newCell, 1);
        // The cell is now registered in the registry
        expect(store.getRegisteredCellById('batch_rollback_registry_cell')).toBe(newCell);
        throw new Error('rollback');
      });
    }).toThrowError('rollback');

    // After rollback, the cell should no longer be in the registry
    expect(store.getRegisteredCellById('batch_rollback_registry_cell')).toBeUndefined();
  });

  it('batch rollback removes id-less cells from the registry', () => {
    const store = createStore();
    const scope = store.root;

    const noIdCell = cell(0);
    const initialCount = store.listRegisteredCells().length;

    expect(() => {
      scope.batch(() => {
        scope.set(noIdCell, 1);
        // The cell is now in the registry's cells set
        expect(store.listRegisteredCells().length).toBe(initialCount + 1);
        expect(store.listRegisteredCells()).toContain(noIdCell);
        throw new Error('rollback');
      });
    }).toThrowError('rollback');

    // After rollback, the id-less cell should also be removed
    expect(store.listRegisteredCells().length).toBe(initialCount);
    expect(store.listRegisteredCells()).not.toContain(noIdCell);
  });

  // --- Edge case tests ---

  it('defaultEqual treats NaN as equal to NaN', () => {
    const n = cell<number>(NaN, { id: 'nan_equal_cell' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    scope.set(n, NaN);

    expect(listener).not.toHaveBeenCalled();
  });

  it('asValue wraps undefined and falsy values correctly', () => {
    const box = asValue(undefined);
    expect(box.__scopeFluxValue).toBeUndefined();
    expect('__scopeFluxValue' in box).toBe(true);

    const zeroBox = asValue(0);
    expect(zeroBox.__scopeFluxValue).toBe(0);

    const nullBox = asValue(null);
    expect(nullBox.__scopeFluxValue).toBeNull();
  });

  it('set with ValueBox bypasses updater detection', () => {
    const count = cell(0, { id: 'valuebox_set_count' });
    const scope = createStore().fork();
    const fn = (prev: number) => prev + 1;

    // Without asValue, function is treated as updater
    scope.set(count, fn);
    expect(scope.get(count)).toBe(1);

    // With asValue, function itself is stored (but cell type is number, so this tests the mechanism)
    const fnCell = cell<(...args: any[]) => any>(() => 0, { id: 'valuebox_fn_cell' });
    const myFn = () => 42;
    scope.set(fnCell, asValue(myFn));
    expect(scope.get(fnCell)).toBe(myFn);
  });

  it('updater returning same value does not bump version or notify', () => {
    const count = cell(5, { id: 'updater_noop_count' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    scope.set(count, (prev) => prev);

    expect(listener).not.toHaveBeenCalled();
    expect(scope.get(count)).toBe(5);
  });

  it('computed with zero dependencies caches value', () => {
    let runs = 0;
    const constant = computed([] as const, () => {
      runs += 1;
      return 42;
    });
    const scope = createStore().fork();

    expect(scope.get(constant)).toBe(42);
    expect(scope.get(constant)).toBe(42);
    expect(runs).toBe(1);
  });

  it('event emit with function payload passes it to handler', () => {
    const fn = () => 'hello';
    const onFn = event<() => string>({ debugName: 'fn_payload_event' });
    const scope = createStore().fork();
    let received: (() => string) | undefined;

    scope.on(onFn, (payload) => {
      received = payload;
    });
    scope.emit(onFn, fn);

    expect(received).toBe(fn);
    expect(received!()).toBe('hello');
  });

  it('on() unsubscribe cleans up empty handler set from map', () => {
    const ping = event<void>({ debugName: 'cleanup_handler_set_ping' });
    const scope = createStore().fork();

    const unsub1 = scope.on(ping, () => {});
    const unsub2 = scope.on(ping, () => {});
    unsub1();
    // one handler still exists, map entry should remain
    scope.emit(ping, undefined);

    unsub2();
    // now empty - map entry should be cleaned up
    // verify by emitting again - no crash means cleanup is safe
    scope.emit(ping, undefined);
  });

  it('triple-nested batch rollback restores all intermediate state', () => {
    const count = cell(0, { id: 'triple_nested_rollback_count' });
    const scope = createStore().fork();

    scope.batch(() => {
      scope.set(count, 1);
      scope.batch(() => {
        scope.set(count, 2);
        expect(() => {
          scope.batch(() => {
            scope.set(count, 3);
            throw new Error('deep_fail');
          });
        }).toThrowError('deep_fail');
        // innermost rolled back, should be 2
        expect(scope.get(count)).toBe(2);
      });
    });

    expect(scope.get(count)).toBe(2);
  });

  it('effect with timeoutMs:0 aborts immediately', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return 1;
    });

    await expect(
      scope.run(fx, undefined, { timeoutMs: 0 })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('effect with retryDelayMs function returning negative is clamped to 0', async () => {
    const scope = createStore().fork();
    let attempt = 0;
    const fx = effect<void, number>(() => {
      attempt += 1;
      if (attempt < 2) throw new Error('fail');
      return 10;
    }, {
      policy: { retries: 1, retryDelayMs: () => -100 },
    });

    await expect(scope.run(fx, undefined)).resolves.toBe(10);
    expect(attempt).toBe(2);
  });

  it('effect with external abort signal aborts the effect', async () => {
    const scope = createStore().fork();
    const controller = new AbortController();
    const fx = effect<void, number>(async () => {
      await new Promise((r) => setTimeout(r, 200));
      return 1;
    });

    const promise = scope.run(fx, undefined, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('effect with already-aborted signal rejects immediately', async () => {
    const scope = createStore().fork();
    const controller = new AbortController();
    controller.abort();
    const fx = effect<void, number>(async () => 1);

    await expect(
      scope.run(fx, undefined, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('subscribeEffectStatus unsubscribe cleans up listener set', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 1);
    const listener = vi.fn();
    const unsub = scope.subscribeEffectStatus(fx, listener);
    unsub();

    await scope.run(fx, undefined);
    expect(listener).not.toHaveBeenCalled();
  });

  it('getEffectStatus returns defaults for never-run effect', () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 1);
    const status = scope.getEffectStatus(fx);

    expect(status.running).toBe(0);
    expect(status.queued).toBe(0);
    expect(status.lastError).toBeUndefined();
    expect(status.lastResult).toBeUndefined();
  });

  it('cancelEffect on never-run effect is a no-op', () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 1);

    expect(() => scope.cancelEffect(fx)).not.toThrow();
  });

  it('fork preserves parent cell values and is isolated for mutations', () => {
    const a = cell(1, { id: 'fork_preserve_a' });
    const b = cell(2, { id: 'fork_preserve_b' });
    const store = createStore();
    const parent = store.fork();
    parent.set(a, 10);
    parent.set(b, 20);

    const child = parent.fork();
    expect(child.get(a)).toBe(10);
    expect(child.get(b)).toBe(20);

    child.set(a, 100);
    expect(child.get(a)).toBe(100);
    expect(parent.get(a)).toBe(10);
  });

  it('history controller: multiple sets to same cell in one commit records first prev and last next', () => {
    const count = cell(0, { id: 'history_multi_set_count' });
    const scope = createStore().fork();
    const history = createHistoryController(scope);

    scope.batch(() => {
      scope.set(count, 1);
      scope.set(count, 2);
      scope.set(count, 3);
    });

    expect(scope.get(count)).toBe(3);
    expect(history.undo()).toBe(true);
    expect(scope.get(count)).toBe(0);
  });

  it('history controller: undo clears redo stack on new commit', () => {
    const count = cell(0, { id: 'history_redo_clear_count' });
    const scope = createStore().fork();
    const history = createHistoryController(scope);

    scope.set(count, 1);
    scope.set(count, 2);
    history.undo();
    expect(history.canRedo()).toBe(true);

    scope.set(count, 5);
    expect(history.canRedo()).toBe(false);
  });

  it('history controller: clear empties both stacks', () => {
    const count = cell(0, { id: 'history_clear_stacks_count' });
    const scope = createStore().fork();
    const history = createHistoryController(scope);

    scope.set(count, 1);
    scope.set(count, 2);
    history.undo();

    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('history controller: unsubscribe stops recording', () => {
    const count = cell(0, { id: 'history_unsubscribe_count' });
    const scope = createStore().fork();
    const history = createHistoryController(scope);

    scope.set(count, 1);
    expect(history.canUndo()).toBe(true);

    history.unsubscribe();
    scope.set(count, 2);
    // only 1 entry from before unsubscribe
    expect(history.getSize().undo).toBe(1);
  });

  it('registerCell is idempotent for same cell', () => {
    const c = cell(0, { id: 'register_idempotent_cell' });
    const scope = createStore().fork();

    scope.registerCell(c);
    scope.registerCell(c);

    expect(scope.get(c)).toBe(0);
  });

  it('registerCell rejects non-cell units', () => {
    const scope = createStore().fork();
    expect(() => scope.registerCell(null as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
    expect(() => scope.registerCell({ kind: 'event' } as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('subscribeUnit for computed notifies only when output changes', () => {
    const source = cell(1, { id: 'sub_computed_output_source' });
    const clamped = computed([source], (v) => Math.min(v, 5));
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribeUnit(clamped, listener);

    scope.set(source, 3);
    expect(listener).toHaveBeenCalledTimes(1);

    // Setting to 6 and 7 both clamp to 5; only first should notify
    scope.set(source, 6);
    expect(listener).toHaveBeenCalledTimes(2);

    scope.set(source, 7);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('scope.isHydrated tracks hydrated IDs', () => {
    const count = cell(0, { id: 'hydrated_check_cell' });
    const scope = createStore().fork();

    expect(scope.isHydrated('hydrated_check_cell')).toBe(false);
  });

  it('listKnownCells returns cells that have been set or read', () => {
    const a = cell(1, { id: 'known_cells_a' });
    const b = cell(2, { id: 'known_cells_b' });
    const scope = createStore().fork();

    scope.get(a);
    scope.set(b, 3);

    const known = scope.listKnownCells();
    expect(known).toContain(a);
    expect(known).toContain(b);
  });

  it('_flush calls all scope listeners even when one throws', () => {
    const count = cell(0, { id: 'flush_listener_throw_count' });
    const scope = createStore().fork();
    const listenerA = vi.fn();
    const listenerB = vi.fn(() => { throw new Error('listener_boom'); });
    const listenerC = vi.fn();

    scope.subscribe(listenerA);
    scope.subscribe(listenerB);
    scope.subscribe(listenerC);

    expect(() => scope.set(count, 1)).toThrowError('listener_boom');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerC).toHaveBeenCalledTimes(1);
  });

  it('_notifyUnitSubscribers calls all unit listeners even when one throws', () => {
    const a = cell(0, { id: 'unit_listener_throw_a' });
    const b = cell(0, { id: 'unit_listener_throw_b' });
    const scope = createStore().fork();
    const listenerA = vi.fn(() => { throw new Error('unit_boom'); });
    const listenerB = vi.fn();

    scope.subscribeUnit(a, listenerA);
    scope.subscribeUnit(b, listenerB);

    expect(() => {
      scope.batch(() => {
        scope.set(a, 1);
        scope.set(b, 1);
      });
    }).toThrowError('unit_boom');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('_notifyEffectSubscribers calls all effect listeners even when one throws', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 1);
    const listenerA = vi.fn(() => { throw new Error('effect_boom'); });
    const listenerB = vi.fn();

    scope.subscribeEffectStatus(fx, listenerA);
    scope.subscribeEffectStatus(fx, listenerB);

    await expect(scope.run(fx, undefined)).rejects.toThrowError('effect_boom');
    expect(listenerA).toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalled();
  });

  it('reset restores cell to its init value', () => {
    const count = cell(10, { id: 'reset_count' });
    const scope = createStore().fork();
    scope.set(count, 42);
    expect(scope.get(count)).toBe(42);

    scope.reset(count);
    expect(scope.get(count)).toBe(10);
  });

  it('reset emits a commit with the change', () => {
    const count = cell(0, { id: 'reset_commit_count' });
    const scope = createStore().fork();
    scope.set(count, 5);

    const commits: Array<{ changes: Array<{ kind: string; prev: unknown; next: unknown }> }> = [];
    scope.subscribe((evt) => {
      commits.push(evt as any);
    });

    scope.reset(count);
    expect(commits).toHaveLength(1);
    expect(commits[0].changes[0]).toMatchObject({ kind: 'set', prev: 5, next: 0 });
  });

  it('reset is a no-op when cell already has init value', () => {
    const count = cell(0, { id: 'reset_noop_count' });
    const scope = createStore().fork();
    const listener = vi.fn();
    scope.subscribe(listener);

    scope.reset(count);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset throws for non-cell units', () => {
    const scope = createStore().fork();
    expect(() => scope.reset(null as any)).toThrowError(/NS_CORE_INVALID_UPDATE/);
  });

  it('destroy clears all subscriptions and state', () => {
    const a = cell(1, { id: 'destroy_a' });
    const scope = createStore().fork();
    scope.set(a, 10);

    const listener = vi.fn();
    scope.subscribe(listener);
    scope.subscribeUnit(a, vi.fn());

    scope.destroy();

    expect(scope.listKnownCells()).toEqual([]);
    // Listener should not fire after destroy
    expect(() => scope.set(a, 20)).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('destroy cancels running effects', async () => {
    const scope = createStore().fork();
    let aborted = false;
    const fx = effect<void, void>(async (_p, ctx) => {
      try {
        await new Promise((_, reject) => {
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      } catch {
        aborted = true;
        throw new Error('aborted');
      }
    });

    const promise = scope.run(fx, undefined).catch(() => {});
    scope.destroy();
    await promise;
    expect(aborted).toBe(true);
  });

  it('store.destroy clears root scope and registry', () => {
    const a = cell(1, { id: 'store_destroy_a' });
    const store = createStore();
    store.root.set(a, 10);
    expect(store.getRegisteredCellById('store_destroy_a')).toBe(a);

    store.destroy();
    expect(store.getRegisteredCellById('store_destroy_a')).toBeUndefined();
    expect(store.root.listKnownCells()).toEqual([]);
  });

  it('combine creates a computed tuple from multiple cells', () => {
    const a = cell(1, { id: 'combine_a' });
    const b = cell('hello', { id: 'combine_b' });
    const combined = combine([a, b]);
    const scope = createStore().fork();

    expect(scope.get(combined)).toEqual([1, 'hello']);

    scope.set(a, 2);
    expect(scope.get(combined)).toEqual([2, 'hello']);

    scope.set(b, 'world');
    expect(scope.get(combined)).toEqual([2, 'world']);
  });

  it('combine caches like a regular computed', () => {
    const a = cell(1, { id: 'combine_cache_a' });
    const b = cell(2, { id: 'combine_cache_b' });
    const combined = combine([a, b]);
    const scope = createStore().fork();

    const first = scope.get(combined);
    const second = scope.get(combined);
    expect(first).toBe(second);
  });

  it('combine works with computed dependencies', () => {
    const a = cell(3, { id: 'combine_computed_a' });
    const doubled = computed([a], (v) => v * 2);
    const combined = combine([a, doubled]);
    const scope = createStore().fork();

    expect(scope.get(combined)).toEqual([3, 6]);
    scope.set(a, 5);
    expect(scope.get(combined)).toEqual([5, 10]);
  });

  it('fork copies hydratedIds from parent', () => {
    const count = cell(0, { id: 'fork_hydrated_count' });
    const store = createStore();
    const parent = store.fork();

    const { hydrate } = require('@suzumiyaaoba/scope-flux-serializer');
    parent.registerCell(count);
    hydrate(parent, { version: 1, scopeId: 's', values: { fork_hydrated_count: 5 } });

    expect(parent.isHydrated('fork_hydrated_count')).toBe(true);

    const child = parent.fork();
    expect(child.isHydrated('fork_hydrated_count')).toBe(true);
    expect(child.get(count)).toBe(5);
  });

  describe('watch', () => {
    it('calls handler with value and prev when cell changes', () => {
      const counter = cell(0, { id: 'watch_counter_1' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler);
      scope.set(counter, 1);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1, 0);
    });

    it('calls handler on each change', () => {
      const counter = cell(0, { id: 'watch_counter_2' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler);
      scope.set(counter, 1);
      scope.set(counter, 2);
      scope.set(counter, 3);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls).toEqual([
        [1, 0],
        [2, 1],
        [3, 2],
      ]);
    });

    it('does not call handler when value is unchanged', () => {
      const counter = cell(0, { id: 'watch_counter_3' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler);
      scope.set(counter, 0); // same value

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const counter = cell(0, { id: 'watch_counter_4' });
      const scope = createStore().fork();
      const handler = vi.fn();

      const unwatch = scope.watch(counter, handler);
      scope.set(counter, 1);
      expect(handler).toHaveBeenCalledTimes(1);

      unwatch();
      scope.set(counter, 2);
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('supports immediate option', () => {
      const counter = cell(42, { id: 'watch_counter_5' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler, { immediate: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(42, undefined);
    });

    it('supports once option', () => {
      const counter = cell(0, { id: 'watch_counter_6' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler, { once: true });
      scope.set(counter, 1);
      scope.set(counter, 2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1, 0);
    });

    it('immediate + once calls handler once with current value only', () => {
      const counter = cell(10, { id: 'watch_counter_7' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(counter, handler, { immediate: true, once: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(10, undefined);

      scope.set(counter, 20);
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('watches computed units', () => {
      const base = cell(2, { id: 'watch_base_1' });
      const doubled = computed([base], (v) => v * 2);
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(doubled, handler);
      scope.set(base, 3);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(6, 4);
    });

    it('watches computed with immediate', () => {
      const base = cell(5, { id: 'watch_base_2' });
      const doubled = computed([base], (v) => v * 2);
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(doubled, handler, { immediate: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(10, undefined);
    });

    it('does not fire for computed when result is unchanged', () => {
      const base = cell(2, { id: 'watch_base_3' });
      const isPositive = computed([base], (v) => v > 0);
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch(isPositive, handler);
      scope.set(base, 3); // isPositive remains true

      expect(handler).not.toHaveBeenCalled();
    });

    it('works with batch - fires after commit', () => {
      const a = cell(0, { id: 'watch_batch_a' });
      const b = cell(0, { id: 'watch_batch_b' });
      const scope = createStore().fork();
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      scope.watch(a, handlerA);
      scope.watch(b, handlerB);

      scope.batch(() => {
        scope.set(a, 1);
        scope.set(b, 2);
        // handlers should not be called yet inside batch
        expect(handlerA).not.toHaveBeenCalled();
        expect(handlerB).not.toHaveBeenCalled();
      });

      expect(handlerA).toHaveBeenCalledWith(1, 0);
      expect(handlerB).toHaveBeenCalledWith(2, 0);
    });

    it('watches multiple units', () => {
      const firstName = cell('John', { id: 'watch_multi_first' });
      const lastName = cell('Doe', { id: 'watch_multi_last' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch([firstName, lastName], handler);
      scope.set(firstName, 'Jane');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(['Jane', 'Doe'], ['John', 'Doe']);
    });

    it('watches multiple units with batch', () => {
      const firstName = cell('John', { id: 'watch_multi_batch_first' });
      const lastName = cell('Doe', { id: 'watch_multi_batch_last' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch([firstName, lastName], handler);

      scope.batch(() => {
        scope.set(firstName, 'Jane');
        scope.set(lastName, 'Smith');
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(['Jane', 'Smith'], ['John', 'Doe']);
    });

    it('watches multiple units with immediate', () => {
      const firstName = cell('John', { id: 'watch_multi_imm_first' });
      const lastName = cell('Doe', { id: 'watch_multi_imm_last' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch([firstName, lastName], handler, { immediate: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(['John', 'Doe'], undefined);
    });

    it('multiple units: does not fire when no watched unit changed', () => {
      const firstName = cell('John', { id: 'watch_multi_nochange_first' });
      const lastName = cell('Doe', { id: 'watch_multi_nochange_last' });
      const other = cell(0, { id: 'watch_multi_nochange_other' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch([firstName, lastName], handler);
      scope.set(other, 1);

      expect(handler).not.toHaveBeenCalled();
    });

    it('multiple units with once fires only once', () => {
      const a = cell(0, { id: 'watch_multi_once_a' });
      const b = cell(0, { id: 'watch_multi_once_b' });
      const scope = createStore().fork();
      const handler = vi.fn();

      scope.watch([a, b], handler, { once: true });
      scope.set(a, 1);
      scope.set(b, 1);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith([1, 0], [0, 0]);
    });
  });

  describe('retry strategies', () => {
    it('retries with exponential backoff strategy', async () => {
      let attempts = 0;
      const delays: number[] = [];
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 4) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 4,
              strategy: 'exponential',
              baseDelay: 100,
              maxDelay: 10000,
              jitter: 'none',
            },
          },
        }
      );

      const scope = createStore().fork();

      // Mock setTimeout to capture delays
      const origWaitMs = globalThis.setTimeout;
      vi.useFakeTimers();

      const resultPromise = scope.run(fx, undefined);

      // Advance through retries: delays should be 100, 200, 400 (exponential)
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await resultPromise;
      expect(result).toBe('ok');
      expect(attempts).toBe(4);

      vi.useRealTimers();
    });

    it('retries with linear backoff strategy', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 3,
              strategy: 'linear',
              baseDelay: 100,
              jitter: 'none',
            },
          },
        }
      );

      const scope = createStore().fork();
      vi.useFakeTimers();

      const resultPromise = scope.run(fx, undefined);

      // Linear delays: 100, 200
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result).toBe('ok');
      expect(attempts).toBe(3);

      vi.useRealTimers();
    });

    it('caps delay at maxDelay', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 5) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 5,
              strategy: 'exponential',
              baseDelay: 100,
              maxDelay: 300,
              jitter: 'none',
            },
          },
        }
      );

      const scope = createStore().fork();
      vi.useFakeTimers();

      const resultPromise = scope.run(fx, undefined);

      // Delays: 100, 200, 300 (capped), 300 (capped)
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(300);
      }

      const result = await resultPromise;
      expect(result).toBe('ok');

      vi.useRealTimers();
    });

    it('respects retryIf predicate', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts === 1) throw new Error('retryable');
          if (attempts === 2) throw new Error('fatal');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 5,
              strategy: 'fixed',
              baseDelay: 0,
              retryIf: (err) => (err as Error).message === 'retryable',
            },
          },
        }
      );

      const scope = createStore().fork();

      await expect(scope.run(fx, undefined)).rejects.toThrow('fatal');
      expect(attempts).toBe(2);
    });

    it('uses custom strategy function', async () => {
      let attempts = 0;
      const customDelays: number[] = [];
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 3,
              strategy: (attempt) => {
                const delay = attempt * 50;
                customDelays.push(delay);
                return delay;
              },
              jitter: 'none',
            },
          },
        }
      );

      const scope = createStore().fork();
      vi.useFakeTimers();

      const resultPromise = scope.run(fx, undefined);
      await vi.advanceTimersByTimeAsync(50);  // attempt 1 → 50ms
      await vi.advanceTimersByTimeAsync(100); // attempt 2 → 100ms

      const result = await resultPromise;
      expect(result).toBe('ok');
      expect(customDelays).toEqual([50, 100]);

      vi.useRealTimers();
    });

    it('applies full jitter (delay between 0 and computed delay)', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 3,
              strategy: 'exponential',
              baseDelay: 1000,
              jitter: 'full',
            },
          },
        }
      );

      const scope = createStore().fork();
      vi.useFakeTimers();

      // With full jitter, delay is random between 0 and baseDelay * 2^(attempt-1)
      // We just need to advance enough time for it to complete
      const resultPromise = scope.run(fx, undefined);
      await vi.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;
      expect(result).toBe('ok');
      expect(attempts).toBe(3);

      vi.useRealTimers();
    });

    it('backward compatible with retries number shorthand', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retries: 2,
            retryDelayMs: 0,
          },
        }
      );

      const scope = createStore().fork();
      const result = await scope.run(fx, undefined);
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    it('fixed strategy uses constant delay', async () => {
      let attempts = 0;
      const fx = effect(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'ok';
        },
        {
          policy: {
            retry: {
              maxAttempts: 3,
              strategy: 'fixed',
              baseDelay: 50,
              jitter: 'none',
            },
          },
        }
      );

      const scope = createStore().fork();
      vi.useFakeTimers();

      const resultPromise = scope.run(fx, undefined);
      await vi.advanceTimersByTimeAsync(50); // first retry
      await vi.advanceTimersByTimeAsync(50); // second retry

      const result = await resultPromise;
      expect(result).toBe('ok');
      expect(attempts).toBe(3);

      vi.useRealTimers();
    });
  });

  describe('operators', () => {
    describe('merge', () => {
      it('merges multiple events into one', () => {
        const a = event<string>();
        const b = event<string>();
        const c = event<string>();
        const scope = createStore().fork();
        const { event: merged } = merge([a, b, c], scope);
        const handler = vi.fn();

        scope.on(merged, handler);
        scope.emit(a, 'from-a');
        scope.emit(b, 'from-b');
        scope.emit(c, 'from-c');

        expect(handler).toHaveBeenCalledTimes(3);
        expect(handler.mock.calls[0][0]).toBe('from-a');
        expect(handler.mock.calls[1][0]).toBe('from-b');
        expect(handler.mock.calls[2][0]).toBe('from-c');
      });

      it('returns unsubscribe that stops forwarding', () => {
        const a = event<number>();
        const b = event<number>();
        const scope = createStore().fork();
        const { event: merged, unsubscribe } = merge([a, b], scope);
        const handler = vi.fn();

        scope.on(merged, handler);
        scope.emit(a, 1);
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();
        scope.emit(a, 2);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('split', () => {
      it('routes event payload to matching targets', () => {
        const source = event<{ status: number; data: string }>();
        const scope = createStore().fork();
        const successHandler = vi.fn();
        const errorHandler = vi.fn();
        const fallbackHandler = vi.fn();

        const targets = split(source, scope, {
          success: (p) => p.status === 200,
          error: (p) => p.status >= 500,
        });

        scope.on(targets.success, successHandler);
        scope.on(targets.error, errorHandler);

        scope.emit(source, { status: 200, data: 'ok' });
        scope.emit(source, { status: 500, data: 'err' });
        scope.emit(source, { status: 404, data: 'not found' }); // no match

        expect(successHandler).toHaveBeenCalledTimes(1);
        expect(successHandler.mock.calls[0][0]).toEqual({ status: 200, data: 'ok' });
        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0]).toEqual({ status: 500, data: 'err' });
      });

      it('returns unsubscribe function', () => {
        const source = event<number>();
        const scope = createStore().fork();
        const handler = vi.fn();

        const targets = split(source, scope, {
          even: (n) => n % 2 === 0,
        });

        scope.on(targets.even, handler);
        scope.emit(source, 2);
        expect(handler).toHaveBeenCalledTimes(1);

        targets.unsubscribe();
        scope.emit(source, 4);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('guard', () => {
      it('forwards event when filter passes', () => {
        const source = event<number>();
        const target = event<number>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        guard(source, scope, {
          filter: (n) => n > 0,
          target,
        });

        scope.emit(source, 5);
        scope.emit(source, -1);
        scope.emit(source, 3);

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[0][0]).toBe(5);
        expect(handler.mock.calls[1][0]).toBe(3);
      });

      it('returns unsubscribe function', () => {
        const source = event<number>();
        const target = event<number>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        const unsub = guard(source, scope, {
          filter: (n) => n > 0,
          target,
        });

        scope.emit(source, 1);
        expect(handler).toHaveBeenCalledTimes(1);

        unsub();
        scope.emit(source, 2);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('sample', () => {
      it('samples source value when clock fires', () => {
        const form = cell({ name: 'John', valid: true }, { id: 'sample_form' });
        const submit = event<void>();
        const target = event<{ name: string; valid: boolean }>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        sample({
          clock: submit,
          source: form,
          target,
          scope,
        });

        scope.set(form, { name: 'Jane', valid: true });
        scope.emit(submit, undefined);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toEqual({ name: 'Jane', valid: true });
      });

      it('applies filter predicate', () => {
        const form = cell({ name: 'John', valid: false }, { id: 'sample_form_filter' });
        const submit = event<void>();
        const target = event<{ name: string; valid: boolean }>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        sample({
          clock: submit,
          source: form,
          target,
          scope,
          filter: (formData) => formData.valid,
        });

        scope.emit(submit, undefined); // filter blocks (valid: false)
        expect(handler).not.toHaveBeenCalled();

        scope.set(form, { name: 'Jane', valid: true });
        scope.emit(submit, undefined); // filter passes
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('applies fn transform', () => {
        const name = cell('John', { id: 'sample_name_fn' });
        const submit = event<void>();
        const target = event<string>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        sample({
          clock: submit,
          source: name,
          target,
          scope,
          fn: (n) => n.toUpperCase(),
        });

        scope.emit(submit, undefined);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toBe('JOHN');
      });

      it('returns unsubscribe function', () => {
        const counter = cell(0, { id: 'sample_counter_unsub' });
        const tick = event<void>();
        const target = event<number>();
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(target, handler);
        const unsub = sample({
          clock: tick,
          source: counter,
          target,
          scope,
        });

        scope.emit(tick, undefined);
        expect(handler).toHaveBeenCalledTimes(1);

        unsub();
        scope.emit(tick, undefined);
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('debounce', () => {
    it('debounces event emissions (trailing)', () => {
      const source = event<string>();
      const scope = createStore().fork();
      const { event: debounced } = debounce(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(debounced, handler);

      scope.emit(source, 'a');
      scope.emit(source, 'b');
      scope.emit(source, 'c');

      expect(handler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe('c');

      vi.useRealTimers();
    });

    it('debounces with leading option', () => {
      const source = event<string>();
      const scope = createStore().fork();
      const { event: debounced } = debounce(source, scope, 100, { leading: true });
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(debounced, handler);

      scope.emit(source, 'a');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe('a');

      scope.emit(source, 'b');
      scope.emit(source, 'c');
      expect(handler).toHaveBeenCalledTimes(1); // still 1 during debounce window

      vi.advanceTimersByTime(100);
      // trailing fires after window
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[1][0]).toBe('c');

      vi.useRealTimers();
    });

    it('resets timer on each emission', () => {
      const source = event<number>();
      const scope = createStore().fork();
      const { event: debounced } = debounce(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(debounced, handler);

      scope.emit(source, 1);
      vi.advanceTimersByTime(50);
      scope.emit(source, 2); // resets timer
      vi.advanceTimersByTime(50);
      expect(handler).not.toHaveBeenCalled(); // only 50ms since last emit

      vi.advanceTimersByTime(50);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe(2);

      vi.useRealTimers();
    });

    it('returns unsubscribe that cleans up', () => {
      const source = event<number>();
      const scope = createStore().fork();
      const { event: debounced, unsubscribe } = debounce(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(debounced, handler);

      scope.emit(source, 1);
      unsubscribe();
      vi.advanceTimersByTime(100);
      expect(handler).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('throttle', () => {
    it('throttles event emissions', () => {
      const source = event<string>();
      const scope = createStore().fork();
      const { event: throttled } = throttle(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(throttled, handler);

      scope.emit(source, 'a'); // fires immediately (leading)
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe('a');

      scope.emit(source, 'b'); // throttled
      scope.emit(source, 'c'); // throttled
      expect(handler).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      // trailing fires with last value
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[1][0]).toBe('c');

      vi.useRealTimers();
    });

    it('allows next emission after interval', () => {
      const source = event<number>();
      const scope = createStore().fork();
      const { event: throttled } = throttle(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(throttled, handler);

      scope.emit(source, 1);
      expect(handler).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      scope.emit(source, 2);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[1][0]).toBe(2);

      vi.useRealTimers();
    });

    it('returns unsubscribe that cleans up', () => {
      const source = event<number>();
      const scope = createStore().fork();
      const { event: throttled, unsubscribe } = throttle(source, scope, 100);
      const handler = vi.fn();

      vi.useFakeTimers();
      scope.on(throttled, handler);

      scope.emit(source, 1);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      vi.advanceTimersByTime(200);
      scope.emit(source, 2);
      expect(handler).toHaveBeenCalledTimes(1); // no more emissions

      vi.useRealTimers();
    });
  });

  describe('families', () => {
    describe('cellFamily', () => {
      it('creates cells by parameter', () => {
        const userCell = cellFamily((id: string) => cell(`user-${id}`, { id: `fam_user_${id}` }));
        const scope = createStore().fork();

        expect(scope.get(userCell('abc'))).toBe('user-abc');
        expect(scope.get(userCell('xyz'))).toBe('user-xyz');
      });

      it('returns same unit for same parameter', () => {
        const userCell = cellFamily((id: string) => cell(id, { id: `fam_memo_${id}` }));

        expect(userCell('abc')).toBe(userCell('abc'));
        expect(userCell('abc')).not.toBe(userCell('xyz'));
      });

      it('supports custom isEqual for parameter comparison', () => {
        const coordCell = cellFamily(
          (coord: { x: number; y: number }) => cell(coord, { id: `fam_coord_${coord.x}_${coord.y}` }),
          { isEqual: (a, b) => a.x === b.x && a.y === b.y }
        );

        const a = coordCell({ x: 1, y: 2 });
        const b = coordCell({ x: 1, y: 2 });
        expect(a).toBe(b);
      });

      it('remove deletes cached unit', () => {
        const fam = cellFamily((id: string) => cell(0, { id: `fam_rm_${id}` }));
        const first = fam('a');
        fam.remove('a');
        const second = fam('a');
        expect(first).not.toBe(second);
      });

      it('clear removes all cached units', () => {
        const fam = cellFamily((id: string) => cell(0, { id: `fam_clr_${id}` }));
        fam('a');
        fam('b');
        fam.clear();
        const newA = fam('a');
        expect(newA).not.toBe(fam('b'));
      });
    });

    describe('computedFamily', () => {
      it('creates computed by parameter', () => {
        const base = cell(10, { id: 'fam_comp_base' });
        const multiplied = computedFamily((factor: number) =>
          computed([base], (v) => v * factor)
        );
        const scope = createStore().fork();

        expect(scope.get(multiplied(2))).toBe(20);
        expect(scope.get(multiplied(3))).toBe(30);
      });

      it('memoizes computed instances', () => {
        const base = cell(0, { id: 'fam_comp_memo_base' });
        const fam = computedFamily((n: number) => computed([base], (v) => v + n));
        expect(fam(1)).toBe(fam(1));
      });
    });

    describe('eventFamily', () => {
      it('creates events by parameter', () => {
        const fam = eventFamily((channel: string) => event<string>({ debugName: channel }));
        const scope = createStore().fork();
        const handler = vi.fn();

        scope.on(fam('chat'), handler);
        scope.emit(fam('chat'), 'hello');

        expect(handler).toHaveBeenCalledWith('hello', expect.anything(), expect.anything());
      });

      it('memoizes event instances', () => {
        const fam = eventFamily((_: string) => event<void>());
        expect(fam('a')).toBe(fam('a'));
      });
    });

    describe('effectFamily', () => {
      it('creates effects by parameter', async () => {
        const fam = effectFamily((url: string) =>
          effect(async () => `fetched:${url}`)
        );
        const scope = createStore().fork();

        const result = await scope.run(fam('/api/users'), undefined);
        expect(result).toBe('fetched:/api/users');
      });

      it('memoizes effect instances', () => {
        const fam = effectFamily((_: string) => effect(async () => 'ok'));
        expect(fam('x')).toBe(fam('x'));
      });
    });
  });

  describe('middleware', () => {
    it('intercepts set calls with ctx and next', () => {
      const counter = cell(0, { id: 'mw_counter' });
      const log: string[] = [];

      const store = createStore({
        middleware: [
          (ctx, next) => {
            log.push(`before:${ctx.unit.meta.id}:${ctx.nextValue}`);
            next();
            log.push(`after:${ctx.unit.meta.id}:${ctx.nextValue}`);
          },
        ],
      });
      const scope = store.root;

      scope.set(counter, 5);
      expect(log).toEqual(['before:mw_counter:5', 'after:mw_counter:5']);
      expect(scope.get(counter)).toBe(5);
    });

    it('middleware can reject updates by not calling next', () => {
      const age = cell(25, { id: 'mw_age' });

      const store = createStore({
        middleware: [
          (ctx, next) => {
            if (ctx.unit.meta.id === 'mw_age' && (ctx.nextValue as number) < 0) {
              return; // reject
            }
            next();
          },
        ],
      });
      const scope = store.root;

      scope.set(age, -1);
      expect(scope.get(age)).toBe(25); // unchanged

      scope.set(age, 30);
      expect(scope.get(age)).toBe(30); // accepted
    });

    it('middleware can transform values', () => {
      const name = cell('', { id: 'mw_name' });

      const store = createStore({
        middleware: [
          (ctx, next) => {
            if (ctx.unit.meta.id === 'mw_name') {
              ctx.nextValue = (ctx.nextValue as string).trim().toUpperCase();
            }
            next();
          },
        ],
      });
      const scope = store.root;

      scope.set(name, '  hello  ');
      expect(scope.get(name)).toBe('HELLO');
    });

    it('multiple middleware run in order (FIFO)', () => {
      const counter = cell(0, { id: 'mw_order' });
      const order: number[] = [];

      const store = createStore({
        middleware: [
          (_ctx, next) => { order.push(1); next(); },
          (_ctx, next) => { order.push(2); next(); },
          (_ctx, next) => { order.push(3); next(); },
        ],
      });
      const scope = store.root;

      scope.set(counter, 1);
      expect(order).toEqual([1, 2, 3]);
    });

    it('scope.use adds middleware dynamically', () => {
      const counter = cell(0, { id: 'mw_dynamic' });
      const log: string[] = [];

      const store = createStore();
      const scope = store.root;

      scope.use((ctx, next) => {
        log.push(`intercepted:${ctx.nextValue}`);
        next();
      });

      scope.set(counter, 10);
      expect(log).toEqual(['intercepted:10']);
    });

    it('middleware receives previousValue', () => {
      const counter = cell(5, { id: 'mw_prev' });
      let captured: unknown;

      const store = createStore({
        middleware: [
          (ctx, next) => {
            captured = ctx.previousValue;
            next();
          },
        ],
      });
      const scope = store.root;

      scope.set(counter, 10);
      expect(captured).toBe(5);
    });
  });

  describe('transaction', () => {
    it('commits changes on success', async () => {
      const counter = cell(0, { id: 'tx_commit' });
      const scope = createStore().fork();

      await scope.transaction(async (tx) => {
        tx.set(counter, 10);
      });

      expect(scope.get(counter)).toBe(10);
    });

    it('rolls back changes on error', async () => {
      const counter = cell(5, { id: 'tx_rollback' });
      const scope = createStore().fork();

      await expect(
        scope.transaction(async (tx) => {
          tx.set(counter, 99);
          throw new Error('server error');
        })
      ).rejects.toThrow('server error');

      expect(scope.get(counter)).toBe(5); // rolled back
    });

    it('rolls back multiple cell changes on error', async () => {
      const a = cell(1, { id: 'tx_multi_a' });
      const b = cell(2, { id: 'tx_multi_b' });
      const scope = createStore().fork();

      await expect(
        scope.transaction(async (tx) => {
          tx.set(a, 100);
          tx.set(b, 200);
          throw new Error('fail');
        })
      ).rejects.toThrow('fail');

      expect(scope.get(a)).toBe(1);
      expect(scope.get(b)).toBe(2);
    });

    it('supports nested reads within transaction', async () => {
      const counter = cell(10, { id: 'tx_read' });
      const scope = createStore().fork();

      await scope.transaction(async (tx) => {
        const val = tx.get(counter);
        tx.set(counter, val + 5);
      });

      expect(scope.get(counter)).toBe(15);
    });

    it('optimistic: applies immediately and rolls back on error', async () => {
      const todos = cell<string[]>(['buy milk'], { id: 'tx_optimistic' });
      const scope = createStore().fork();
      const changes: string[][] = [];

      scope.watch(todos, (val) => { changes.push([...val]); });

      const promise = scope.transaction(async (tx) => {
        tx.set(todos, ['buy milk', 'new todo']);
        // Simulate async failure
        await new Promise((r) => setTimeout(r, 10));
        throw new Error('server rejected');
      });

      // Optimistically applied
      expect(scope.get(todos)).toEqual(['buy milk', 'new todo']);

      await expect(promise).rejects.toThrow('server rejected');

      // Rolled back
      expect(scope.get(todos)).toEqual(['buy milk']);
    });
  });

  describe('history checkpoints', () => {
    it('checkpoint saves and restores state', () => {
      const a = cell(0, { id: 'cp_a' });
      const b = cell(0, { id: 'cp_b' });
      const scope = createStore().fork();
      const history = createHistoryController(scope, { track: [a, b] });

      scope.set(a, 1);
      scope.set(b, 2);
      history.checkpoint('saved');

      scope.set(a, 100);
      scope.set(b, 200);
      expect(scope.get(a)).toBe(100);

      history.restoreCheckpoint('saved');
      expect(scope.get(a)).toBe(1);
      expect(scope.get(b)).toBe(2);
    });

    it('listCheckpoints returns all saved checkpoints', () => {
      const a = cell(0, { id: 'cp_list_a' });
      const scope = createStore().fork();
      const history = createHistoryController(scope, { track: [a] });

      scope.set(a, 1);
      history.checkpoint('first');
      scope.set(a, 2);
      history.checkpoint('second');

      expect(history.listCheckpoints()).toEqual(['first', 'second']);
    });

    it('deleteCheckpoint removes a checkpoint', () => {
      const a = cell(0, { id: 'cp_del_a' });
      const scope = createStore().fork();
      const history = createHistoryController(scope, { track: [a] });

      scope.set(a, 1);
      history.checkpoint('temp');
      history.deleteCheckpoint('temp');

      expect(history.listCheckpoints()).toEqual([]);
    });

    it('restoreCheckpoint returns false for unknown checkpoint', () => {
      const scope = createStore().fork();
      const history = createHistoryController(scope);

      expect(history.restoreCheckpoint('nonexistent')).toBe(false);
    });
  });

  describe('computed cache strategies', () => {
    it('ttl cache expires after specified time', () => {
      const base = cell(1, { id: 'cache_ttl_base' });
      let evalCount = 0;
      const derived = computed([base], (v) => {
        evalCount++;
        return v * 2;
      }, { cache: { strategy: 'ttl', ttlMs: 100 } });

      const scope = createStore().fork();
      vi.useFakeTimers();

      expect(scope.get(derived)).toBe(2);
      expect(evalCount).toBe(1);

      // Within TTL, should use cache even though we read again
      scope.get(derived);
      expect(evalCount).toBe(1);

      // Advance past TTL
      vi.advanceTimersByTime(101);
      scope.get(derived);
      expect(evalCount).toBe(2); // re-evaluated

      vi.useRealTimers();
    });

    it('scope cache (default) does not expire by time', () => {
      const base = cell(1, { id: 'cache_scope_base' });
      let evalCount = 0;
      const derived = computed([base], (v) => {
        evalCount++;
        return v * 2;
      }); // default cache: 'scope'

      const scope = createStore().fork();
      vi.useFakeTimers();

      scope.get(derived);
      expect(evalCount).toBe(1);

      vi.advanceTimersByTime(10000);
      scope.get(derived);
      expect(evalCount).toBe(1); // still cached

      vi.useRealTimers();
    });

    it('none cache always re-evaluates', () => {
      const base = cell(1, { id: 'cache_none_base' });
      let evalCount = 0;
      const derived = computed([base], (v) => {
        evalCount++;
        return v * 2;
      }, { cache: 'none' });

      const scope = createStore().fork();

      scope.get(derived);
      scope.get(derived);
      expect(evalCount).toBe(2);
    });
  });
});
