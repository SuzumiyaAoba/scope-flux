import type { AnyCell, Cell, Priority, Scope, UpdateOptions } from '@suzumiyaaoba/scope-flux-core';

export interface PendingBufferedUpdate {
  cell: AnyCell;
  value: unknown;
  priority: Exclude<Priority, 'urgent'>;
  reason?: string;
}

export interface SchedulerOptions {
  scope: Scope;
}

export class Scheduler {
  private readonly scope: Scope;
  private readonly bufferedValues = new Map<AnyCell, unknown>();
  private readonly pendingByCell = new Map<AnyCell, PendingBufferedUpdate>();
  private readonly bufferedSubscribers = new Set<() => void>();

  constructor(options: SchedulerOptions) {
    this.scope = options.scope;
  }

  public getCommitted<T>(cell: Cell<T>): T {
    return this.scope.get(cell);
  }

  public getBuffered<T>(cell: Cell<T>): T {
    const anyCell = cell as AnyCell;
    if (this.bufferedValues.has(anyCell)) {
      return this.bufferedValues.get(anyCell) as T;
    }
    return this.scope.get(cell);
  }

  public set<T>(
    cell: Cell<T>,
    next: T | ((prev: T) => T),
    options: UpdateOptions = {}
  ): void {
    const anyCell = cell as AnyCell;
    const priority = options.priority ?? 'urgent';

    if (priority === 'urgent') {
      this.scope.set(cell, next, options);
      if (this.pendingByCell.has(anyCell)) {
        this.pendingByCell.delete(anyCell);
        this.bufferedValues.delete(anyCell);
        this._notifyBuffered();
      }
      return;
    }

    const prev = this.getBuffered<T>(cell);
    const value = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;

    this.bufferedValues.set(anyCell, value);
    this.pendingByCell.set(anyCell, {
      cell: anyCell,
      value,
      priority,
      reason: options.reason,
    });
    this._notifyBuffered();
  }

  public getPendingBufferedUpdates(): PendingBufferedUpdate[] {
    return [...this.pendingByCell.values()];
  }

  public flushBuffered(options: { reason?: string } = {}): void {
    const updates = [...this.pendingByCell.values()];
    this.pendingByCell.clear();

    try {
      this.scope.batch(() => {
        for (const update of updates) {
          this.scope.set(update.cell as Cell<unknown>, update.value, {
            priority: 'urgent',
            reason: options.reason ?? update.reason ?? 'scheduler.flushBuffered',
          });
        }
      });
    } catch (error) {
      for (const update of updates) {
        this.pendingByCell.set(update.cell, update);
      }
      throw error;
    }

    this.bufferedValues.clear();
    this._notifyBuffered();
  }

  public dropBuffered(): void {
    this.pendingByCell.clear();
    this.bufferedValues.clear();
    this._notifyBuffered();
  }

  public subscribeBuffered(listener: () => void): () => void {
    this.bufferedSubscribers.add(listener);
    return () => {
      this.bufferedSubscribers.delete(listener);
    };
  }

  private _notifyBuffered(): void {
    const listeners = [...this.bufferedSubscribers];
    for (const listener of listeners) {
      listener();
    }
  }
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}
