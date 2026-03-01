import type { AnyCell, Priority, Scope, UpdateOptions } from '@scope-flux/core';

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

  public getCommitted<T>(cell: AnyCell): T {
    return this.scope.get(cell) as T;
  }

  public getBuffered<T>(cell: AnyCell): T {
    if (this.bufferedValues.has(cell)) {
      return this.bufferedValues.get(cell) as T;
    }
    return this.scope.get(cell) as T;
  }

  public set<T>(
    cell: AnyCell,
    next: T | ((prev: T) => T),
    options: UpdateOptions = {}
  ): void {
    const priority = options.priority ?? 'urgent';

    if (priority === 'urgent') {
      this.scope.set(cell as any, next as any, options);
      return;
    }

    const prev = this.getBuffered<T>(cell);
    const value = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;

    this.bufferedValues.set(cell, value);
    this.pendingByCell.set(cell, {
      cell,
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

    this.scope.batch(() => {
      for (const update of updates) {
        this.scope.set(update.cell as any, update.value as any, {
          priority: 'urgent',
          reason: options.reason ?? update.reason ?? 'scheduler.flushBuffered',
        });
      }
    });

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
    for (const listener of this.bufferedSubscribers) {
      listener();
    }
  }
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}
