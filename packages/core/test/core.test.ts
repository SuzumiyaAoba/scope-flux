import { describe, expect, it, vi } from 'vitest';

import { cell, computed, createStore, event, getRegisteredCellById, listRegisteredCells } from '../src/index.js';
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
});
