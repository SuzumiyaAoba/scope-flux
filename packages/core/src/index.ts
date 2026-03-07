export type StableId = string;
export type Priority = 'urgent' | 'transition' | 'idle';

export interface UnitMeta {
  id?: StableId;
  debugName?: string;
  serializable?: boolean;
}

export interface UpdateOptions {
  priority?: Priority;
  reason?: string;
}

export interface RunOptions extends UpdateOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

export interface EffectPolicy {
  concurrency?: 'parallel' | 'drop' | 'replace' | 'queue';
  retries?: number;
  retryDelayMs?: number | ((attempt: number, error: unknown) => number);
}

export interface EffectContext {
  scope: Scope;
  signal: AbortSignal;
  attempt: number;
}

export type ScopeListener = (evt: CommitEvent) => void;
export type EffectStatusListener = () => void;
export type Unsubscribe = () => void;

export interface Cell<T> {
  kind: 'cell';
  init: T;
  meta: UnitMeta;
  equal?: (a: T, b: T) => boolean;
  readonly __type?: T;
}

export interface ValueBox<T> {
  __scopeFluxValue: T;
}

type DepUnit = Cell<any> | Computed<any, any>;
type UnitValue<U> = U extends { readonly __type?: infer V } ? V : never;
export type ComputedDeps = readonly DepUnit[];
export type ComputedArgs<D extends ComputedDeps> = {
  [K in keyof D]: UnitValue<D[K]>;
};

export interface Computed<T, D extends ComputedDeps = ComputedDeps> {
  kind: 'computed';
  deps: D;
  read: (...args: ComputedArgs<D>) => T;
  cache: 'scope' | 'none';
  meta: UnitMeta;
  readonly __type?: T;
}

export interface Event<P> {
  kind: 'event';
  meta: UnitMeta;
}

export interface Effect<P, R> {
  kind: 'effect';
  handler: (payload: P, ctx: EffectContext) => Promise<R> | R;
  policy: Required<EffectPolicy>;
  meta: UnitMeta;
}

export interface EffectStatus<R = unknown> {
  running: number;
  queued: number;
  lastError?: unknown;
  lastResult?: R;
  lastStartedAt?: number;
  lastFinishedAt?: number;
}

type AnyCell = Cell<any>;
type AnyComputed = Computed<unknown, ComputedDeps>;

type AnyUnit = AnyCell | AnyComputed;

interface ComputedCacheEntry {
  evaluating: boolean;
  deps: Map<AnyUnit, number>;
  value: unknown;
}

export interface SetChange {
  kind: 'set';
  unit: AnyCell;
  prev: unknown;
  next: unknown;
  reason?: string;
}

export interface EventChange {
  kind: 'event';
  unit: Event<unknown>;
  payload: unknown;
  reason?: string;
}

export interface EffectChange {
  kind: 'effect';
  unit: Effect<unknown, unknown>;
  payload: unknown;
  reason?: string;
}

export type Change = SetChange | EventChange | EffectChange;

export interface CommitEvent {
  type: 'commit';
  priority: Priority;
  changes: Change[];
}

export type SeedInput = Map<Cell<any>, unknown> | Array<readonly [Cell<any>, unknown]>;

export const ErrorCodes = {
  DUPLICATE_STABLE_ID: 'NS_CORE_DUPLICATE_STABLE_ID',
  INVALID_UPDATE: 'NS_CORE_INVALID_UPDATE',
  CYCLE_DETECTED: 'NS_CORE_CYCLE_DETECTED',
  MISSING_HANDLER: 'NS_CORE_MISSING_HANDLER',
  EFFECT_DROPPED: 'NS_CORE_EFFECT_DROPPED',
  EFFECT_ABORTED: 'NS_CORE_EFFECT_ABORTED',
  EFFECT_TIMEOUT: 'NS_CORE_EFFECT_TIMEOUT',
  EFFECT_REPLACED: 'NS_CORE_EFFECT_REPLACED',
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defaultEqual<T>(a: T, b: T): boolean {
  return Object.is(a, b);
}

function isValueBox<T>(value: unknown): value is ValueBox<T> {
  return isObject(value) && '__scopeFluxValue' in value;
}

function toAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function waitMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function abortReasonAsError(signal: AbortSignal, fallbackMessage: string): Error {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) {
    return reason;
  }
  if (typeof reason === 'string') {
    return toAbortError(reason);
  }
  return toAbortError(fallbackMessage);
}

function waitMsWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(abortReasonAsError(signal, ErrorCodes.EFFECT_ABORTED));
  }
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortReasonAsError(signal, ErrorCodes.EFFECT_ABORTED));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(abortReasonAsError(signal, ErrorCodes.EFFECT_ABORTED));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(abortReasonAsError(signal, ErrorCodes.EFFECT_ABORTED));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function normalizeEffectPolicy(policy: EffectPolicy | undefined): Required<EffectPolicy> {
  return {
    concurrency: policy?.concurrency ?? 'parallel',
    retries: policy?.retries ?? 0,
    retryDelayMs: policy?.retryDelayMs ?? 0,
  };
}

export function cell<T>(init: T, options: UnitMeta & { equal?: (a: T, b: T) => boolean } = {}): Cell<T> {
  const unit: Cell<T> = {
    kind: 'cell',
    init,
    meta: {
      id: options.id,
      debugName: options.debugName,
      serializable: options.serializable ?? true,
    },
    equal: options.equal,
  };

  return unit;
}

export function computed<const D extends ComputedDeps, T>(
  deps: D,
  read: (...args: ComputedArgs<D>) => T,
  options: { debugName?: string; cache?: 'scope' | 'none' } = {}
): Computed<T, D> {
  return {
    kind: 'computed',
    deps,
    read,
    cache: options.cache ?? 'scope',
    meta: {
      debugName: options.debugName,
    },
  };
}

export function event<P>(options: { debugName?: string } = {}): Event<P> {
  return {
    kind: 'event',
    meta: {
      debugName: options.debugName,
    },
  };
}

export function effect<P, R>(
  handler: (payload: P, ctx: EffectContext) => Promise<R> | R,
  options: { debugName?: string; policy?: EffectPolicy } = {}
): Effect<P, R> {
  if (typeof handler !== 'function') {
    throw new Error(ErrorCodes.MISSING_HANDLER);
  }

  return {
    kind: 'effect',
    handler,
    policy: normalizeEffectPolicy(options.policy),
    meta: {
      debugName: options.debugName,
    },
  };
}

interface EffectQueueItem {
  start: () => void;
  reject: (error: unknown) => void;
}

interface EffectRuntimeState {
  running: number;
  queue: EffectQueueItem[];
  controllers: Set<AbortController>;
  lastError?: unknown;
  lastResult?: unknown;
  lastStartedAt?: number;
  lastFinishedAt?: number;
}

class StoreRegistry {
  private readonly cellsById = new Map<string, AnyCell>();
  private readonly cells = new Set<AnyCell>();

  public register(cellUnit: AnyCell): void {
    this.cells.add(cellUnit);
    const id = cellUnit.meta.id;
    if (!id) {
      return;
    }
    const existing = this.cellsById.get(id);
    if (existing && existing !== cellUnit) {
      throw new Error(`${ErrorCodes.DUPLICATE_STABLE_ID}:${id}`);
    }
    this.cellsById.set(id, cellUnit);
  }

  public getById(id: string): AnyCell | undefined {
    return this.cellsById.get(id);
  }

  public list(): AnyCell[] {
    return Array.from(this.cells);
  }

  public unregisterById(id: string): boolean {
    const cellUnit = this.cellsById.get(id);
    if (!cellUnit) {
      return false;
    }
    this.cellsById.delete(id);
    this.cells.delete(cellUnit);
    return true;
  }

  public clear(): void {
    this.cellsById.clear();
    this.cells.clear();
  }
}

export class Scope {
  private static _nextId = 0;
  public readonly id: string;

  private readonly _cellValues = new Map<AnyCell, unknown>();
  private readonly _cellVersions = new Map<AnyCell, number>();
  private readonly _computedVersions = new Map<AnyComputed, number>();
  private readonly _computedCache = new Map<AnyComputed, ComputedCacheEntry>();
  private readonly _subscribers = new Set<ScopeListener>();
  private readonly _unitSubscribers = new Map<AnyUnit, Set<() => void>>();
  private readonly _eventHandlers = new Map<Event<unknown>, Set<(payload: unknown, scope: Scope, options: UpdateOptions) => void>>();
  private readonly _effectStates = new Map<Effect<unknown, unknown>, EffectRuntimeState>();
  private readonly _effectSubscribers = new Map<Effect<unknown, unknown>, Set<EffectStatusListener>>();
  private readonly _knownCells = new Set<AnyCell>();
  private readonly _hydratedIds = new Set<string>();
  private readonly _registry: StoreRegistry;

  private _batchDepth = 0;
  private _pendingChanges: Change[] = [];
  private _pendingPriority: Priority | undefined;

  constructor(registry: StoreRegistry, seed?: SeedInput) {
    this._registry = registry;
    this.id = `scope_${Scope._nextId++}`;
    if (seed) {
      this._applySeed(seed);
    }
  }

  private _registerCell(cellUnit: AnyCell): void {
    this._knownCells.add(cellUnit);
    this._registry.register(cellUnit);
  }

  private _applySeed(seed: SeedInput): void {
    const applyCellValue = (unit: AnyCell, value: unknown) => {
      if (!unit || unit.kind !== 'cell') {
        throw new Error(ErrorCodes.INVALID_UPDATE);
      }
      this._registerCell(unit);
      this._cellValues.set(unit, value);
      this._cellVersions.set(unit, 1);
    };

    if (seed instanceof Map) {
      for (const [unit, value] of seed.entries()) {
        applyCellValue(unit, value);
      }
      return;
    }

    if (Array.isArray(seed)) {
      for (const [unit, value] of seed) {
        applyCellValue(unit, value);
      }
      return;
    }

    throw new Error(ErrorCodes.INVALID_UPDATE);
  }

  private static readonly _priorityRank: Record<Priority, number> = {
    urgent: 2,
    transition: 1,
    idle: 0,
  };

  private _pushChange(change: Change, options?: UpdateOptions): void {
    this._pendingChanges.push(change);
    const incoming = options?.priority;
    if (incoming === undefined) {
      return;
    }
    if (this._pendingPriority === undefined ||
        Scope._priorityRank[incoming] > Scope._priorityRank[this._pendingPriority]) {
      this._pendingPriority = incoming;
    }
  }

  private _flush(): void {
    if (this._pendingChanges.length === 0) {
      return;
    }

    const payload: CommitEvent = {
      type: 'commit',
      priority: this._pendingPriority ?? 'urgent',
      changes: this._pendingChanges,
    };

    this._pendingChanges = [];
    this._pendingPriority = undefined;

    const listeners = Array.from(this._subscribers);
    for (const listener of listeners) {
      listener(payload);
    }
    this._notifyUnitSubscribers(payload.changes);
  }

  private _notifyUnitSubscribers(changes: Change[]): void {
    if (this._unitSubscribers.size === 0) {
      return;
    }

    const notified = new Set<() => void>();
    for (const change of changes) {
      if (change.kind !== 'set') {
        continue;
      }
      const listeners = this._unitSubscribers.get(change.unit as AnyUnit);
      if (!listeners) {
        continue;
      }
      for (const listener of Array.from(listeners)) {
        if (notified.has(listener)) {
          continue;
        }
        notified.add(listener);
        listener();
      }
    }
  }

  private _getEffectState(effectUnit: Effect<unknown, unknown>): EffectRuntimeState {
    let state = this._effectStates.get(effectUnit);
    if (state) {
      return state;
    }
    state = {
      running: 0,
      queue: [],
      controllers: new Set<AbortController>(),
    };
    this._effectStates.set(effectUnit, state);
    return state;
  }

  private _notifyEffectSubscribers(effectUnit: Effect<unknown, unknown>): void {
    const listeners = this._effectSubscribers.get(effectUnit);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const listener of Array.from(listeners)) {
      listener();
    }
  }

  private _dequeueEffect(state: EffectRuntimeState): void {
    if (state.running > 0) {
      return;
    }
    const queued = state.queue.shift();
    if (!queued) {
      return;
    }
    queued.start();
  }

  private async _executeEffect<P, R>(
    unitEffect: Effect<P, R>,
    payload: P,
    options: RunOptions,
    state: EffectRuntimeState
  ): Promise<R> {
    const controller = new AbortController();
    state.controllers.add(controller);
    state.running += 1;
    state.lastStartedAt = Date.now();
    this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let externalAbortListener: (() => void) | undefined;

    if (options.timeoutMs !== undefined && options.timeoutMs >= 0) {
      timeoutId = setTimeout(() => {
        controller.abort(toAbortError(`${ErrorCodes.EFFECT_TIMEOUT}:${options.timeoutMs}`));
      }, options.timeoutMs);
    }

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort((options.signal as AbortSignal & { reason?: unknown }).reason);
      } else {
        externalAbortListener = () => {
          controller.abort((options.signal as AbortSignal & { reason?: unknown }).reason);
        };
        options.signal.addEventListener('abort', externalAbortListener, { once: true });
      }
    }

    this._pushChange(
      {
        kind: 'effect',
        unit: unitEffect as Effect<unknown, unknown>,
        payload,
        reason: options.reason,
      },
      options
    );

    if (this._batchDepth === 0) {
      this._flush();
    }

    try {
      const retries = options.retries ?? unitEffect.policy.retries;
      const maxAttempts = Math.max(0, retries) + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (controller.signal.aborted) {
          throw toAbortError(ErrorCodes.EFFECT_ABORTED);
        }
        try {
          const result = await raceWithAbort(
            Promise.resolve(
              unitEffect.handler(payload, {
                scope: this,
                signal: controller.signal,
                attempt,
              })
            ),
            controller.signal
          );
          if (controller.signal.aborted) {
            throw toAbortError(ErrorCodes.EFFECT_ABORTED);
          }
          state.lastResult = result;
          state.lastError = undefined;
          this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
          return result;
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            state.lastError = error;
            this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
            throw error;
          }
          if (attempt >= maxAttempts) {
            state.lastError = error;
            this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
            throw error;
          }
          const rawDelay = unitEffect.policy.retryDelayMs;
          const delayMs = typeof rawDelay === 'function' ? rawDelay(attempt, error) : rawDelay;
          await waitMsWithAbort(Math.max(0, delayMs), controller.signal);
        }
      }

      throw new Error('NS_CORE_UNREACHABLE');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (options.signal && externalAbortListener) {
        options.signal.removeEventListener('abort', externalAbortListener);
      }
      state.controllers.delete(controller);
      state.running = Math.max(0, state.running - 1);
      state.lastFinishedAt = Date.now();
      this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
      this._dequeueEffect(state);
    }
  }

  private _withBatch<T>(fn: () => T): T {
    this._batchDepth += 1;
    const prevLength = this._pendingChanges.length;
    const prevPriority = this._pendingPriority;
    const prevCellValues = new Map(this._cellValues);
    const prevCellVersions = new Map(this._cellVersions);
    const prevComputedVersions = new Map(this._computedVersions);
    const prevComputedCache = new Map(this._computedCache);
    const prevKnownCells = new Set(this._knownCells);
    const prevHydratedIds = new Set(this._hydratedIds);
    try {
      const result = fn();
      this._batchDepth -= 1;
      if (this._batchDepth === 0) {
        this._flush();
      }
      return result;
    } catch (error) {
      this._batchDepth -= 1;
      this._pendingChanges.splice(prevLength);
      this._pendingPriority = prevPriority;
      for (const cellUnit of this._knownCells) {
        if (!prevKnownCells.has(cellUnit)) {
          const id = cellUnit.meta.id;
          if (id) {
            this._registry.unregisterById(id);
          }
        }
      }
      this._cellValues.clear();
      this._cellVersions.clear();
      this._computedVersions.clear();
      this._computedCache.clear();
      this._knownCells.clear();
      this._hydratedIds.clear();
      for (const [k, v] of prevCellValues.entries()) this._cellValues.set(k, v);
      for (const [k, v] of prevCellVersions.entries()) this._cellVersions.set(k, v);
      for (const [k, v] of prevComputedVersions.entries()) this._computedVersions.set(k, v);
      for (const [k, v] of prevComputedCache.entries()) this._computedCache.set(k, v);
      for (const v of prevKnownCells.values()) this._knownCells.add(v);
      for (const v of prevHydratedIds.values()) this._hydratedIds.add(v);
      if (this._batchDepth === 0) {
        this._flush();
      }
      throw error;
    }
  }

  private _setCellValue<T>(unit: Cell<T>, next: T, options?: UpdateOptions): boolean {
    const prev = this.get(unit);
    const equal = unit.equal ?? defaultEqual<T>;
    if (equal(prev, next)) {
      return false;
    }

    this._registerCell(unit as AnyCell);
    this._cellValues.set(unit as AnyCell, next);

    const currentVersion = this._cellVersions.get(unit as AnyCell) ?? 0;
    this._cellVersions.set(unit as AnyCell, currentVersion + 1);

    this._pushChange(
      {
        kind: 'set',
        unit: unit as AnyCell,
        prev,
        next,
        reason: options?.reason,
      },
      options
    );

    return true;
  }

  private _getUnitVersion(unit: AnyUnit): number {
    if (unit.kind === 'cell') {
      return this._cellVersions.get(unit as AnyCell) ?? 0;
    }

    this.get(unit as AnyComputed);
    return this._computedVersions.get(unit as AnyComputed) ?? 0;
  }

  private _getComputed<T>(unit: Computed<T>): T {
    const u = unit as AnyComputed;
    const cached = this._computedCache.get(u);
    if (cached?.evaluating) {
      throw new Error(ErrorCodes.CYCLE_DETECTED);
    }

    if (cached && unit.cache !== 'none') {
      let valid = true;
      for (const [dep, ver] of cached.deps.entries()) {
        if (this._getUnitVersion(dep) !== ver) {
          valid = false;
          break;
        }
      }
      if (valid) {
        return cached.value as T;
      }
    }

    const deps = new Map<AnyUnit, number>();
    const args: unknown[] = [];
    const prevVersion = this._computedVersions.get(u);
    this._computedCache.set(u, { evaluating: true, deps: new Map(), value: undefined });
    try {
      for (const depUnit of unit.deps as ComputedDeps) {
        const depValue = this.get(depUnit);
        deps.set(depUnit as AnyUnit, this._getUnitVersion(depUnit as AnyUnit));
        args.push(depValue);
      }

      const nextValue = unit.read(...(args as any[]));
      const prevValue = cached?.value as T | undefined;

      this._computedCache.set(u, {
        evaluating: false,
        deps,
        value: nextValue,
      });

      if (!defaultEqual(prevValue, nextValue)) {
        const version = this._computedVersions.get(u) ?? 0;
        this._computedVersions.set(u, version + 1);
      }

      return nextValue;
    } catch (error) {
      if (cached) {
        this._computedCache.set(u, cached);
      } else {
        this._computedCache.delete(u);
      }
      if (prevVersion !== undefined) {
        this._computedVersions.set(u, prevVersion);
      } else {
        this._computedVersions.delete(u);
      }
      throw error;
    }
  }

  public get<T>(unit: Cell<T> | Computed<T>): T {
    if (!unit || !isObject(unit)) {
      throw new Error(ErrorCodes.INVALID_UPDATE);
    }

    if (unit.kind === 'cell') {
      const c = unit as AnyCell;
      this._registerCell(c);
      if (this._cellValues.has(c)) {
        return this._cellValues.get(c) as T;
      }
      return unit.init;
    }

    if (unit.kind === 'computed') {
      return this._getComputed(unit);
    }

    throw new Error(ErrorCodes.INVALID_UPDATE);
  }

  public set<T>(unit: Cell<T>, next: T | ((prev: T) => T) | ValueBox<T>, options: UpdateOptions = {}): void {
    if (!unit || unit.kind !== 'cell') {
      throw new Error(ErrorCodes.INVALID_UPDATE);
    }

    const resolved = isValueBox<T>(next)
      ? next.__scopeFluxValue
      : typeof next === 'function'
        ? typeof unit.init === 'function'
          ? next as T
          : (next as (prev: T) => T)(this.get(unit))
        : next;

    this._withBatch(() => {
      this._setCellValue(unit, resolved, options);
    });
  }

  public batch<T>(fn: () => T): T {
    return this._withBatch(fn);
  }

  public registerCell<T>(unit: Cell<T>): void {
    if (!unit || unit.kind !== 'cell') {
      throw new Error(ErrorCodes.INVALID_UPDATE);
    }
    this._registerCell(unit as AnyCell);
  }

  public on<P>(unitEvent: Event<P>, handler: (payload: P, scope: Scope, options: UpdateOptions) => void): Unsubscribe {
    const key = unitEvent as Event<unknown>;
    let set = this._eventHandlers.get(key);
    if (!set) {
      set = new Set();
      this._eventHandlers.set(key, set);
    }

    const wrapped = handler as (payload: unknown, scope: Scope, options: UpdateOptions) => void;
    set.add(wrapped);

    return () => {
      set?.delete(wrapped);
    };
  }

  public emit<P>(unitEvent: Event<P>, payload: P, options: UpdateOptions = {}): void {
    this._withBatch(() => {
      this._pushChange(
        {
          kind: 'event',
          unit: unitEvent as Event<unknown>,
          payload,
          reason: options.reason,
        },
        options
      );

      const handlers = this._eventHandlers.get(unitEvent as Event<unknown>);
      if (!handlers) {
        return;
      }

      const handlersSnapshot = Array.from(handlers);
      for (const handler of handlersSnapshot) {
        handler(payload, this, options);
      }
    });
  }

  public async run<P, R>(unitEffect: Effect<P, R>, payload: P, options: RunOptions = {}): Promise<R> {
    if (!unitEffect || unitEffect.kind !== 'effect') {
      throw new Error(ErrorCodes.INVALID_UPDATE);
    }

    const state = this._getEffectState(unitEffect as Effect<unknown, unknown>);
    const policy = unitEffect.policy.concurrency;

    if (policy === 'drop' && state.running > 0) {
      throw new Error(ErrorCodes.EFFECT_DROPPED);
    }

    if (policy === 'replace' && state.running > 0) {
      for (const controller of Array.from(state.controllers)) {
        controller.abort(toAbortError(ErrorCodes.EFFECT_REPLACED));
      }
    }

    if (policy === 'queue' && state.running > 0) {
      return await new Promise<R>((resolve, reject) => {
        const item: EffectQueueItem = {
          start: () => {
            this._executeEffect(unitEffect, payload, options, state).then(resolve, reject);
          },
          reject,
        };
        state.queue.push(item);
        this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
      });
    }

    return await this._executeEffect(unitEffect, payload, options, state);
  }

  public subscribe(listener: ScopeListener): Unsubscribe {
    this._subscribers.add(listener);
    return () => {
      this._subscribers.delete(listener);
    };
  }

  public subscribeUnit<T>(unit: Cell<T> | Computed<T>, listener: () => void): Unsubscribe {
    if (unit.kind === 'computed') {
      let prev = this.get(unit);
      const depUnsubscribers: Unsubscribe[] = [];
      for (const dep of unit.deps as ComputedDeps) {
        depUnsubscribers.push(
          this.subscribeUnit(dep as Cell<unknown> | Computed<unknown>, () => {
            const next = this.get(unit);
            if (defaultEqual(prev, next)) {
              return;
            }
            prev = next;
            listener();
          })
        );
      }
      return () => {
        for (const unsub of depUnsubscribers) {
          unsub();
        }
      };
    }
    const key = unit as AnyUnit;
    let listeners = this._unitSubscribers.get(key);
    if (!listeners) {
      listeners = new Set();
      this._unitSubscribers.set(key, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        this._unitSubscribers.delete(key);
      }
    };
  }

  public cancelEffect<P, R>(unitEffect: Effect<P, R>): void {
    const state = this._effectStates.get(unitEffect as Effect<unknown, unknown>);
    if (!state) {
      return;
    }

    const abortError = toAbortError(ErrorCodes.EFFECT_ABORTED);
    for (const controller of Array.from(state.controllers)) {
      controller.abort(abortError);
    }
    const queued = state.queue.splice(0);
    for (const item of queued) {
      item.reject(abortError);
    }
    this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
  }

  public getEffectStatus<P, R>(unitEffect: Effect<P, R>): EffectStatus<R> {
    const state = this._effectStates.get(unitEffect as Effect<unknown, unknown>);
    if (!state) {
      return {
        running: 0,
        queued: 0,
      };
    }

    return {
      running: state.running,
      queued: state.queue.length,
      lastError: state.lastError,
      lastResult: state.lastResult as R | undefined,
      lastStartedAt: state.lastStartedAt,
      lastFinishedAt: state.lastFinishedAt,
    };
  }

  public subscribeEffectStatus<P, R>(
    unitEffect: Effect<P, R>,
    listener: EffectStatusListener
  ): Unsubscribe {
    const key = unitEffect as Effect<unknown, unknown>;
    let listeners = this._effectSubscribers.get(key);
    if (!listeners) {
      listeners = new Set();
      this._effectSubscribers.set(key, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        this._effectSubscribers.delete(key);
      }
    };
  }

  public fork(seed?: SeedInput): Scope {
    const child = new Scope(this._registry);
    for (const [cellUnit, value] of this._cellValues.entries()) {
      child._knownCells.add(cellUnit);
      child._cellValues.set(cellUnit, value);
      child._cellVersions.set(cellUnit, this._cellVersions.get(cellUnit) ?? 0);
    }
    if (seed) {
      child._applySeed(seed);
    }
    return child;
  }

  public listKnownCells(): Cell<any>[] {
    return Array.from(this._knownCells);
  }

  public getRegisteredCellById(id: string): Cell<any> | undefined {
    return this._registry.getById(id);
  }

  public listRegisteredCells(): Cell<any>[] {
    return this._registry.list();
  }

  public unregisterCellById(id: string): boolean {
    return this._registry.unregisterById(id);
  }

  public clearRegisteredCells(): void {
    this._registry.clear();
  }

  public isHydrated(id: string): boolean {
    return this._hydratedIds.has(id);
  }

  public markHydrated(id: string): void {
    this._hydratedIds.add(id);
  }
}

export interface Store {
  root: Scope;
  fork(seed?: SeedInput): Scope;
  getRegisteredCellById(id: string): Cell<any> | undefined;
  listRegisteredCells(): Cell<any>[];
  unregisterCellById(id: string): boolean;
  clearRegisteredCells(): void;
}

interface HistoryStep {
  cell: AnyCell;
  prev: unknown;
  next: unknown;
}

interface HistoryEntry {
  steps: HistoryStep[];
}

export interface HistoryController {
  undo(): boolean;
  redo(): boolean;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  getSize(): { undo: number; redo: number };
  unsubscribe(): void;
}

export interface HistoryOptions {
  limit?: number;
  track?: Cell<any>[];
  reasonPrefix?: string;
}

export function createStore(options: { seed?: SeedInput } = {}): Store {
  const registry = new StoreRegistry();
  const root = new Scope(registry, options.seed);

  return {
    root,
    fork(seed?: SeedInput): Scope {
      return root.fork(seed);
    },
    getRegisteredCellById(id: string): Cell<any> | undefined {
      return registry.getById(id);
    },
    listRegisteredCells(): Cell<any>[] {
      return registry.list();
    },
    unregisterCellById(id: string): boolean {
      return registry.unregisterById(id);
    },
    clearRegisteredCells(): void {
      registry.clear();
    },
  };
}

export function asValue<T>(value: T): ValueBox<T> {
  return {
    __scopeFluxValue: value,
  };
}


export function createHistoryController(
  scope: Scope,
  options: HistoryOptions = {}
): HistoryController {
  const limit = Math.max(1, options.limit ?? 100);
  const trackedCells = options.track ? new Set(options.track) : undefined;
  const reasonPrefix = options.reasonPrefix ?? 'history';
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let applying = false;

  const pushUndo = (entry: HistoryEntry) => {
    undoStack.push(entry);
    if (undoStack.length > limit) {
      undoStack.shift();
    }
  };

  const collapseEntry = (changes: Change[]): HistoryEntry | null => {
    const ordered: HistoryStep[] = [];
    const byCell = new Map<AnyCell, HistoryStep>();

    for (const change of changes) {
      if (change.kind !== 'set') {
        continue;
      }
      const cellUnit = change.unit as AnyCell;
      if (trackedCells && !trackedCells.has(cellUnit)) {
        continue;
      }
      const existing = byCell.get(cellUnit);
      if (!existing) {
        const step: HistoryStep = {
          cell: cellUnit,
          prev: change.prev,
          next: change.next,
        };
        byCell.set(cellUnit, step);
        ordered.push(step);
      } else {
        existing.next = change.next;
      }
    }

    if (ordered.length === 0) {
      return null;
    }

    return { steps: ordered };
  };

  const applyEntry = (entry: HistoryEntry, mode: 'undo' | 'redo') => {
    applying = true;
    try {
      scope.batch(() => {
        const steps = mode === 'undo' ? [...entry.steps].reverse() : entry.steps;
        for (const step of steps) {
          scope.set(step.cell, mode === 'undo' ? step.prev : step.next, {
            priority: 'urgent',
            reason: `${reasonPrefix}.${mode}`,
          });
        }
      });
    } finally {
      applying = false;
    }
  };

  const unsub = scope.subscribe((commit) => {
    if (applying) {
      return;
    }
    const entry = collapseEntry(commit.changes);
    if (!entry) {
      return;
    }
    pushUndo(entry);
    redoStack.length = 0;
  });

  return {
    undo(): boolean {
      const entry = undoStack.pop();
      if (!entry) {
        return false;
      }
      applyEntry(entry, 'undo');
      redoStack.push(entry);
      return true;
    },
    redo(): boolean {
      const entry = redoStack.pop();
      if (!entry) {
        return false;
      }
      applyEntry(entry, 'redo');
      undoStack.push(entry);
      return true;
    },
    clear(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    canUndo(): boolean {
      return undoStack.length > 0;
    },
    canRedo(): boolean {
      return redoStack.length > 0;
    },
    getSize(): { undo: number; redo: number } {
      return {
        undo: undoStack.length,
        redo: redoStack.length,
      };
    },
    unsubscribe(): void {
      unsub();
    },
  };
}
