import { describe, expect, it } from 'vitest';

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
});
