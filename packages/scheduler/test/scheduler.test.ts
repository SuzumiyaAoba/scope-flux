import { describe, expect, it, vi } from 'vitest';

import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import { createScheduler } from '../src/index.js';

describe('scheduler', () => {
  it('applies urgent updates directly to committed store', () => {
    const count = cell(0, { id: 'scheduler_urgent_count' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(count, 1, { priority: 'urgent' });

    expect(scope.get(count)).toBe(1);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(0);
  });

  it('keeps transition updates in buffer until flush', () => {
    const count = cell(0, { id: 'scheduler_transition_count' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(count, 10, { priority: 'transition' });

    expect(scope.get(count)).toBe(0);
    expect(scheduler.getBuffered<number>(count)).toBe(10);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(1);

    scheduler.flushBuffered();

    expect(scope.get(count)).toBe(10);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(0);
  });

  it('treats idle updates as buffered updates', () => {
    const value = cell(0, { id: 'scheduler_idle_value' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(value, (prev) => prev + 2, { priority: 'idle' });

    expect(scope.get(value)).toBe(0);
    expect(scheduler.getBuffered<number>(value)).toBe(2);

    scheduler.flushBuffered();
    expect(scope.get(value)).toBe(2);
  });

  it('can drop buffered updates without touching committed store', () => {
    const count = cell(0, { id: 'scheduler_drop_count' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(count, 5, { priority: 'transition' });
    scheduler.dropBuffered();

    expect(scope.get(count)).toBe(0);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(0);
    expect(scheduler.getBuffered<number>(count)).toBe(0);
  });

  it('coalesces repeated buffered updates for the same cell', () => {
    const count = cell(0, { id: 'scheduler_coalesce_count' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(count, 1, { priority: 'transition' });
    scheduler.set<number>(count, 2, { priority: 'transition' });
    scheduler.set<number>(count, 3, { priority: 'transition' });

    const pending = scheduler.getPendingBufferedUpdates();
    expect(pending).toHaveLength(1);
    expect(pending[0].value).toBe(3);

    scheduler.flushBuffered();
    expect(scope.get(count)).toBe(3);
  });

  it('getCommitted returns authoritative scope value', () => {
    const count = cell(0, { id: 'scheduler_committed_read' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scope.set(count, 9);

    expect(scheduler.getCommitted<number>(count)).toBe(9);
  });

  it('urgent set clears stale buffered entry for the same cell', () => {
    const count = cell(0, { id: 'scheduler_urgent_clears_buffer' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });
    const listener = vi.fn();
    scheduler.subscribeBuffered(listener);

    scheduler.set<number>(count, 10, { priority: 'transition' });
    expect(scheduler.getBuffered<number>(count)).toBe(10);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(1);

    scheduler.set<number>(count, 20, { priority: 'urgent' });
    expect(scope.get(count)).toBe(20);
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(0);
    expect(listener).toHaveBeenCalled();
  });

  it('flushBuffered restores pending updates when batch throws', () => {
    const bad = cell(0, { id: 'scheduler_flush_error_cell', equal: () => false });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope });

    scheduler.set<number>(bad, 5, { priority: 'transition' });

    scope.on(
      { kind: 'event', meta: {} } as any,
      () => {}
    );

    const origBatch = scope.batch.bind(scope);
    scope.batch = <T>(fn: () => T): T => {
      return origBatch(() => {
        fn();
        throw new Error('batch_boom');
      });
    };

    expect(() => scheduler.flushBuffered()).toThrowError('batch_boom');
    expect(scheduler.getPendingBufferedUpdates()).toHaveLength(1);
    expect(scheduler.getPendingBufferedUpdates()[0].value).toBe(5);
  });

  it('autoFlush:microtask flushes buffered updates automatically', async () => {
    const count = cell(0, { id: 'scheduler_autoflush_microtask' });
    const scope = createStore().fork();
    const scheduler = createScheduler({ scope, autoFlush: 'microtask' });

    scheduler.set<number>(count, 4, { priority: 'transition' });
    expect(scope.get(count)).toBe(0);

    await Promise.resolve();
    await Promise.resolve();
    expect(scope.get(count)).toBe(4);
  });

  it('autoFlush:timeout flushes buffered updates automatically', () => {
    vi.useFakeTimers();
    try {
      const count = cell(0, { id: 'scheduler_autoflush_timeout' });
      const scope = createStore().fork();
      const scheduler = createScheduler({ scope, autoFlush: 'timeout', autoFlushDelayMs: 20 });

      scheduler.set<number>(count, 8, { priority: 'transition' });
      expect(scope.get(count)).toBe(0);

      vi.advanceTimersByTime(20);
      expect(scope.get(count)).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });
});
