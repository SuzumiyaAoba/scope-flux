import type { Cell, Priority, Scope, UpdateOptions, ValueBox } from '@suzumiyaaoba/scope-flux-core';

type AnyCell = Cell<unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValueBox<T>(value: unknown): value is ValueBox<T> {
  return isObject(value) && '__scopeFluxValue' in value;
}

export interface PendingBufferedUpdate {
  cell: AnyCell;
  value: unknown;
  priority: Exclude<Priority, 'urgent'>;
  reason?: string;
}

export interface SchedulerOptions {
  scope: Scope;
  autoFlush?: false | 'microtask' | 'timeout' | 'animationFrame' | 'idle';
  autoFlushDelayMs?: number;
}

export class Scheduler {
  private readonly scope: Scope;
  private readonly autoFlush: NonNullable<SchedulerOptions['autoFlush']>;
  private readonly autoFlushDelayMs: number;
  private readonly pendingByCell = new Map<AnyCell, PendingBufferedUpdate>();
  private readonly bufferedSubscribers = new Set<() => void>();
  private _scheduledToken = 0;

  constructor(options: SchedulerOptions) {
    this.scope = options.scope;
    this.autoFlush = options.autoFlush ?? false;
    this.autoFlushDelayMs = Math.max(0, options.autoFlushDelayMs ?? 0);
  }

  public getCommitted<T>(cell: Cell<T>): T {
    return this.scope.get(cell);
  }

  public getBuffered<T>(cell: Cell<T>): T {
    const anyCell = cell as AnyCell;
    const pending = this.pendingByCell.get(anyCell);
    if (pending) {
      return pending.value as T;
    }
    return this.scope.get(cell);
  }

  public set<T>(
    cell: Cell<T>,
    next: T | ((prev: T) => T) | ValueBox<T>,
    options: UpdateOptions = {}
  ): void {
    const anyCell = cell as AnyCell;
    const priority = options.priority ?? 'urgent';

    if (priority === 'urgent') {
      this.scope.set(cell, next, options);
      if (this.pendingByCell.has(anyCell)) {
        this.pendingByCell.delete(anyCell);
        this._notifyBuffered();
      }
      return;
    }

    const prev = this.getBuffered<T>(cell);
    const value = isValueBox<T>(next)
      ? next.__scopeFluxValue
      : typeof next === 'function'
        ? typeof cell.init === 'function'
          ? next as T
          : (next as (prev: T) => T)(prev)
        : next;

    this.pendingByCell.set(anyCell, {
      cell: anyCell,
      value,
      priority,
      reason: options.reason,
    });
    this._notifyBuffered();
    this._scheduleAutoFlush();
  }

  public getPendingBufferedUpdates(): PendingBufferedUpdate[] {
    return [...this.pendingByCell.values()];
  }

  private static readonly _priorityRank: Record<Priority, number> = {
    urgent: 2,
    transition: 1,
    idle: 0,
  };

  public escalate<T>(cell: Cell<T>, newPriority: Exclude<Priority, 'urgent'>): void {
    const anyCell = cell as AnyCell;
    const pending = this.pendingByCell.get(anyCell);
    if (!pending) return;
    if (Scheduler._priorityRank[newPriority] > Scheduler._priorityRank[pending.priority]) {
      pending.priority = newPriority;
      this._notifyBuffered();
    }
  }

  public flushBuffered(options: { reason?: string; cells?: Cell<any>[]; priority?: Exclude<Priority, 'urgent'> } = {}): void {
    this._clearScheduledAutoFlush();
    if (this.pendingByCell.size === 0) {
      return;
    }

    let updates: PendingBufferedUpdate[];
    let partial = false;

    if (options.cells) {
      partial = true;
      const cellSet = new Set<AnyCell>(options.cells as AnyCell[]);
      updates = [];
      for (const [c, update] of this.pendingByCell) {
        if (cellSet.has(c)) {
          updates.push(update);
        }
      }
    } else if (options.priority) {
      partial = true;
      const minRank = Scheduler._priorityRank[options.priority];
      updates = [];
      for (const update of this.pendingByCell.values()) {
        if (Scheduler._priorityRank[update.priority] >= minRank) {
          updates.push(update);
        }
      }
    } else {
      updates = [...this.pendingByCell.values()];
    }

    if (updates.length === 0) {
      return;
    }

    // Remove flushed entries from pending
    for (const update of updates) {
      this.pendingByCell.delete(update.cell);
    }

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
      this._notifyBuffered();
      throw error;
    }

    this._notifyBuffered();
  }

  public dropBuffered(): void {
    this._clearScheduledAutoFlush();
    this.pendingByCell.clear();
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
    let firstError: unknown;
    for (const listener of listeners) {
      try {
        listener();
      } catch (e) {
        firstError ??= e;
      }
    }
    if (firstError !== undefined) {
      throw firstError;
    }
  }

  private _clearScheduledAutoFlush(): void {
    this._scheduledToken += 1;
  }

  private _scheduleAutoFlush(): void {
    if (!this.autoFlush || this.pendingByCell.size === 0) {
      return;
    }

    const token = ++this._scheduledToken;
    const flushIfScheduled = () => {
      if (token !== this._scheduledToken) {
        return;
      }
      this.flushBuffered({ reason: `scheduler.autoFlush.${this.autoFlush}` });
    };

    if (this.autoFlush === 'microtask') {
      queueMicrotask(flushIfScheduled);
      return;
    }

    if (this.autoFlush === 'timeout') {
      setTimeout(flushIfScheduled, this.autoFlushDelayMs);
      return;
    }

    if (this.autoFlush === 'animationFrame') {
      const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => unknown }).requestAnimationFrame;
      if (typeof raf === 'function') {
        raf(flushIfScheduled);
      } else {
        setTimeout(flushIfScheduled, Math.max(16, this.autoFlushDelayMs));
      }
      return;
    }

    if (this.autoFlush === 'idle') {
      const requestIdle = (globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => unknown }).requestIdleCallback;
      if (typeof requestIdle === 'function') {
        requestIdle(flushIfScheduled, { timeout: Math.max(1, this.autoFlushDelayMs || 50) });
      } else {
        setTimeout(flushIfScheduled, this.autoFlushDelayMs || 50);
      }
    }
  }
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}
