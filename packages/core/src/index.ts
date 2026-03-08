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

export type RetryStrategy = 'fixed' | 'linear' | 'exponential' | ((attempt: number, error: unknown) => number);
export type JitterMode = 'none' | 'full';

export interface RetryConfig {
  maxAttempts: number;
  strategy?: RetryStrategy;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: JitterMode;
  retryIf?: (error: unknown) => boolean;
}

export interface EffectPolicy {
  concurrency?: 'parallel' | 'drop' | 'replace' | 'queue';
  retries?: number;
  retryDelayMs?: number | ((attempt: number, error: unknown) => number);
  retry?: RetryConfig;
}

type NormalizedEffectPolicy = Required<Pick<EffectPolicy, 'concurrency' | 'retries' | 'retryDelayMs'>> & { retry?: RetryConfig };

export interface EffectContext {
  scope: Scope;
  signal: AbortSignal;
  attempt: number;
}

export type ScopeListener = (evt: CommitEvent) => void;
export type EffectStatusListener = () => void;
export type Unsubscribe = () => void;

export interface WatchOptions {
  immediate?: boolean;
  once?: boolean;
}

export interface CellSerializer<T> {
  serialize: (value: T) => unknown;
  deserialize: (raw: unknown) => T;
  validate?: (raw: unknown) => boolean;
}

export interface Cell<T> {
  kind: 'cell';
  init: T;
  meta: UnitMeta;
  equal?: (a: T, b: T) => boolean;
  serializer?: CellSerializer<T>;
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

export interface ComputedCacheConfig {
  strategy: 'ttl';
  ttlMs: number;
}

export type ComputedCacheOption = 'scope' | 'none' | ComputedCacheConfig;

export interface Computed<T, D extends ComputedDeps = ComputedDeps> {
  kind: 'computed';
  deps: D;
  read: (...args: ComputedArgs<D>) => T;
  cache: ComputedCacheOption;
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
  policy: NormalizedEffectPolicy;
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
  cachedAt?: number;
}

export interface MiddlewareContext {
  unit: AnyCell;
  previousValue: unknown;
  nextValue: unknown;
  scope: Scope;
}

export type Middleware = (ctx: MiddlewareContext, next: () => void) => void;

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

function normalizeEffectPolicy(policy: EffectPolicy | undefined): NormalizedEffectPolicy {
  return {
    concurrency: policy?.concurrency ?? 'parallel',
    retries: policy?.retries ?? 0,
    retryDelayMs: policy?.retryDelayMs ?? 0,
    retry: policy?.retry,
  };
}

function computeRetryDelay(config: RetryConfig, attempt: number, error: unknown): number {
  const baseDelay = config.baseDelay ?? 0;
  const maxDelay = config.maxDelay ?? Infinity;
  const strategy = config.strategy ?? 'fixed';

  let delay: number;
  if (typeof strategy === 'function') {
    delay = strategy(attempt, error);
  } else {
    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
      default:
        delay = baseDelay;
    }
  }

  delay = Math.min(delay, maxDelay);

  const jitter = config.jitter ?? 'none';
  if (jitter === 'full') {
    delay = Math.random() * delay;
  }

  return Math.max(0, delay);
}

export function cell<T>(init: T, options: UnitMeta & { equal?: (a: T, b: T) => boolean; serializer?: CellSerializer<T> } = {}): Cell<T> {
  const unit: Cell<T> = {
    kind: 'cell',
    init,
    meta: {
      id: options.id,
      debugName: options.debugName,
      serializable: options.serializable ?? true,
    },
    equal: options.equal,
    serializer: options.serializer,
  };

  return unit;
}

// ---------------------------------------------------------------------------
// Async computed
// ---------------------------------------------------------------------------

export type AsyncComputedResult<T> =
  | { status: 'pending' }
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; error: unknown };

export interface AsyncComputedContext {
  signal: AbortSignal;
}

type AsyncComputedRead<D extends ComputedDeps, T> =
  (...args: [...{ [K in keyof ComputedArgs<D>]: ComputedArgs<D>[K] }, AsyncComputedContext]) => Promise<T>;

export interface AsyncComputed<T, D extends ComputedDeps = ComputedDeps> {
  kind: 'asyncComputed';
  deps: D;
  resultCell: Cell<AsyncComputedResult<T>>;
  versionCell: Cell<number>;
  read: (...args: any[]) => Promise<T>;
  meta: UnitMeta;
  readonly __type?: AsyncComputedResult<T>;
}

export function asyncComputed<const D extends ComputedDeps, T>(
  deps: D,
  read: AsyncComputedRead<D, T>,
  options: UnitMeta = {},
): AsyncComputed<T, D> {
  const resultCell = cell<AsyncComputedResult<T>>(
    { status: 'pending' },
    { id: options.id ? `${options.id}__result` : undefined },
  );
  const versionCell = cell(0, {
    id: options.id ? `${options.id}__version` : undefined,
  });
  return {
    kind: 'asyncComputed',
    deps,
    resultCell,
    versionCell,
    read: read as (...args: any[]) => Promise<T>,
    meta: options,
  };
}

export function computed<const D extends ComputedDeps, T>(
  deps: D,
  read: (...args: ComputedArgs<D>) => T,
  options: { debugName?: string; cache?: ComputedCacheOption } = {}
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

  public unregisterCell(cellUnit: AnyCell): void {
    this.cells.delete(cellUnit);
    const id = cellUnit.meta.id;
    if (id && this.cellsById.get(id) === cellUnit) {
      this.cellsById.delete(id);
    }
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
  private readonly _middleware: Middleware[] = [];
  private readonly _asyncComputedAborts = new Map<AsyncComputed<unknown>, AbortController>();
  private readonly _asyncComputedVersions = new Map<AsyncComputed<unknown>, number>();

  private _batchDepth = 0;
  private _pendingChanges: Change[] = [];
  private _pendingPriority: Priority | undefined;

  constructor(registry: StoreRegistry, seed?: SeedInput, middleware?: Middleware[]) {
    this._registry = registry;
    this.id = `scope_${Scope._nextId++}`;
    if (middleware) {
      this._middleware.push(...middleware);
    }
    if (seed) {
      this._applySeed(seed);
    }
  }

  public use(mw: Middleware): void {
    this._middleware.push(mw);
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

    let firstError: unknown;
    const listeners = Array.from(this._subscribers);
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (e) {
        firstError ??= e;
      }
    }
    try {
      this._notifyUnitSubscribers(payload.changes);
    } catch (e) {
      firstError ??= e;
    }
    if (firstError !== undefined) {
      throw firstError;
    }
  }

  private _notifyUnitSubscribers(changes: Change[]): void {
    if (this._unitSubscribers.size === 0) {
      return;
    }

    let firstError: unknown;
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
        try {
          listener();
        } catch (e) {
          firstError ??= e;
        }
      }
    }
    if (firstError !== undefined) {
      throw firstError;
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
    let firstError: unknown;
    for (const listener of Array.from(listeners)) {
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
      const retryConfig = unitEffect.policy.retry;
      const retries = options.retries ?? unitEffect.policy.retries;
      const maxAttempts = retryConfig ? retryConfig.maxAttempts : Math.max(0, retries) + 1;

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

          // Check retryIf predicate (only for retry config)
          if (retryConfig?.retryIf && !retryConfig.retryIf(error)) {
            state.lastError = error;
            this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
            throw error;
          }

          if (attempt >= maxAttempts) {
            state.lastError = error;
            this._notifyEffectSubscribers(unitEffect as Effect<unknown, unknown>);
            throw error;
          }

          let delayMs: number;
          if (retryConfig) {
            delayMs = computeRetryDelay(retryConfig, attempt, error);
          } else {
            const rawDelay = unitEffect.policy.retryDelayMs;
            delayMs = typeof rawDelay === 'function' ? rawDelay(attempt, error) : rawDelay;
          }
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
          this._registry.unregisterCell(cellUnit);
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
      // Check TTL expiration
      if (
        typeof unit.cache === 'object' &&
        unit.cache.strategy === 'ttl' &&
        cached.cachedAt !== undefined &&
        Date.now() - cached.cachedAt >= unit.cache.ttlMs
      ) {
        // TTL expired — fall through to recompute
      } else {
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
        cachedAt: Date.now(),
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

  private _getAsyncComputed<T>(unit: AsyncComputed<T>): AsyncComputedResult<T> {
    // Gather dependency values and check if they changed
    const args: unknown[] = [];
    let depsVersion = 0;
    for (const dep of unit.deps as ComputedDeps) {
      args.push(this.get(dep));
      depsVersion += this._getUnitVersion(dep as AnyUnit);
    }

    const prevVersion = this._asyncComputedVersions.get(unit as AsyncComputed<unknown>);
    if (prevVersion !== undefined && prevVersion === depsVersion) {
      // Dependencies haven't changed, return current result
      return this.get(unit.resultCell);
    }

    // Dependencies changed or first evaluation — abort previous and start new
    const prevAbort = this._asyncComputedAborts.get(unit as AsyncComputed<unknown>);
    if (prevAbort) {
      prevAbort.abort();
    }

    const abortController = new AbortController();
    this._asyncComputedAborts.set(unit as AsyncComputed<unknown>, abortController);
    this._asyncComputedVersions.set(unit as AsyncComputed<unknown>, depsVersion);

    // Set to pending
    this.set(unit.resultCell, { status: 'pending' });

    // Start async evaluation
    const ctx: AsyncComputedContext = { signal: abortController.signal };
    const promise = unit.read(...(args as any[]), ctx);
    const scope = this;

    promise.then(
      (value) => {
        if (!abortController.signal.aborted) {
          scope.set(unit.resultCell, { status: 'fulfilled', value } as AsyncComputedResult<T>);
        }
      },
      (error) => {
        if (!abortController.signal.aborted) {
          scope.set(unit.resultCell, { status: 'rejected', error } as AsyncComputedResult<T>);
        }
      },
    );

    return this.get(unit.resultCell);
  }

  public get<T>(unit: AsyncComputed<T>): AsyncComputedResult<T>;
  public get<T>(unit: Cell<T> | Computed<T>): T;
  public get<T>(unit: Cell<T> | Computed<T> | AsyncComputed<T>): T | AsyncComputedResult<T> {
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
      return this._getComputed(unit as Computed<T>);
    }

    if (unit.kind === 'asyncComputed') {
      return this._getAsyncComputed(unit as unknown as AsyncComputed<unknown>) as T;
    }

    throw new Error(ErrorCodes.INVALID_UPDATE);
  }

  public reset<T>(unit: Cell<T>, options: UpdateOptions = {}): void {
    if (!unit || unit.kind !== 'cell') {
      throw new Error(ErrorCodes.INVALID_UPDATE);
    }
    this.set(unit, unit.init, options);
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

    if (this._middleware.length > 0) {
      const ctx: MiddlewareContext = {
        unit: unit as AnyCell,
        previousValue: this.get(unit),
        nextValue: resolved,
        scope: this,
      };

      let idx = 0;
      const runNext = () => {
        if (idx < this._middleware.length) {
          const mw = this._middleware[idx++];
          mw(ctx, runNext);
        } else {
          this._withBatch(() => {
            this._setCellValue(unit, ctx.nextValue as T, options);
          });
        }
      };
      runNext();
    } else {
      this._withBatch(() => {
        this._setCellValue(unit, resolved, options);
      });
    }
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
      if (set && set.size === 0) {
        this._eventHandlers.delete(key);
      }
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

  public watch<T>(
    unit: Cell<T> | Computed<T>,
    handler: (value: T, prev: T | undefined) => void,
    options?: WatchOptions,
  ): Unsubscribe;
  public watch<U extends readonly (Cell<any> | Computed<any>)[]>(
    units: U,
    handler: (
      values: { [K in keyof U]: UnitValue<U[K]> },
      prev: { [K in keyof U]: UnitValue<U[K]> } | undefined,
    ) => void,
    options?: WatchOptions,
  ): Unsubscribe;
  public watch(
    unitOrUnits: Cell<any> | Computed<any> | readonly (Cell<any> | Computed<any>)[],
    handler: (value: any, prev: any) => void,
    options: WatchOptions = {},
  ): Unsubscribe {
    if (Array.isArray(unitOrUnits)) {
      return this._watchMultiple(unitOrUnits as (Cell<any> | Computed<any>)[], handler, options);
    }
    return this._watchSingle(unitOrUnits as Cell<any> | Computed<any>, handler, options);
  }

  private _watchSingle<T>(
    unit: Cell<T> | Computed<T>,
    handler: (value: T, prev: T | undefined) => void,
    options: WatchOptions,
  ): Unsubscribe {
    let prev: T | undefined = undefined;
    let active = true;

    if (options.immediate) {
      const current = this.get(unit);
      handler(current, undefined);
      prev = current;
      if (options.once) {
        return () => {};
      }
    } else {
      prev = this.get(unit);
    }

    const unsub = this.subscribeUnit(unit, () => {
      if (!active) return;
      const next = this.get(unit);
      const p = prev;
      prev = next;
      handler(next, p);
      if (options.once) {
        active = false;
        unsub();
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }

  private _watchMultiple(
    units: (Cell<any> | Computed<any>)[],
    handler: (values: any[], prev: any[] | undefined) => void,
    options: WatchOptions,
  ): Unsubscribe {
    let prev: any[] | undefined = undefined;
    let active = true;
    const getValues = () => units.map((u) => this.get(u));

    if (options.immediate) {
      const current = getValues();
      handler(current, undefined);
      prev = current;
      if (options.once) {
        return () => {};
      }
    } else {
      prev = getValues();
    }

    const unsubscribers: Unsubscribe[] = [];
    const notified = { flag: false };

    const notify = () => {
      if (!active || notified.flag) return;
      notified.flag = true;

      // Use microtask-like scheduling: defer to after all unit subscribers fire
      // But since subscribeUnit fires after commit, we can just fire inline
      // and use the flag to deduplicate within the same commit.
      const next = getValues();
      const p = prev;

      // Check if any value actually changed
      let changed = false;
      for (let i = 0; i < units.length; i++) {
        if (!Object.is(next[i], p?.[i])) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        notified.flag = false;
        return;
      }

      prev = next;
      handler(next, p);

      if (options.once) {
        active = false;
        for (const unsub of unsubscribers) unsub();
      }
    };

    for (const unit of units) {
      unsubscribers.push(
        this.subscribeUnit(unit, () => {
          notify();
        })
      );
    }

    // Reset flag after all unit subscribers fire for one commit
    unsubscribers.push(this.subscribe(() => {
      notified.flag = false;
    }));

    return () => {
      active = false;
      for (const unsub of unsubscribers) unsub();
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

  public destroy(): void {
    for (const [effectUnit, state] of this._effectStates.entries()) {
      const abortError = toAbortError(ErrorCodes.EFFECT_ABORTED);
      for (const controller of Array.from(state.controllers)) {
        controller.abort(abortError);
      }
      const queued = state.queue.splice(0);
      for (const item of queued) {
        item.reject(abortError);
      }
    }
    this._subscribers.clear();
    this._unitSubscribers.clear();
    this._effectSubscribers.clear();
    this._eventHandlers.clear();
    this._effectStates.clear();
    this._cellValues.clear();
    this._cellVersions.clear();
    this._computedVersions.clear();
    this._computedCache.clear();
    this._knownCells.clear();
    this._hydratedIds.clear();
    this._pendingChanges = [];
    this._pendingPriority = undefined;
  }

  public async transaction<T>(fn: (scope: Scope) => Promise<T>): Promise<T> {
    // Snapshot current cell values for rollback
    const snapshot = new Map<AnyCell, unknown>();
    for (const [c, v] of this._cellValues.entries()) {
      snapshot.set(c, v);
    }
    const snapshotVersions = new Map<AnyCell, number>();
    for (const [c, v] of this._cellVersions.entries()) {
      snapshotVersions.set(c, v);
    }

    try {
      const result = await fn(this);
      return result;
    } catch (error) {
      // Rollback: restore all cells to snapshot state
      const changedCells: AnyCell[] = [];
      for (const [c, prevValue] of snapshot.entries()) {
        const currentValue = this._cellValues.get(c);
        if (!Object.is(currentValue, prevValue)) {
          changedCells.push(c);
          this._cellValues.set(c, prevValue);
        }
      }
      // Restore versions
      for (const [c, ver] of snapshotVersions.entries()) {
        this._cellVersions.set(c, ver);
      }
      // Remove any cells added during transaction
      for (const c of this._cellValues.keys()) {
        if (!snapshot.has(c) && !snapshotVersions.has(c)) {
          this._cellValues.delete(c);
          this._cellVersions.delete(c);
        }
      }

      // Notify subscribers about rollback
      if (changedCells.length > 0) {
        const changes: Change[] = changedCells.map((c) => ({
          kind: 'set' as const,
          unit: c,
          prev: this._cellValues.get(c),
          next: snapshot.get(c)!,
          reason: 'transaction.rollback',
        }));
        const payload: CommitEvent = {
          type: 'commit',
          priority: 'urgent',
          changes,
        };
        for (const listener of Array.from(this._subscribers)) {
          try { listener(payload); } catch {}
        }
        this._notifyUnitSubscribers(changes);
      }

      throw error;
    }
  }

  public fork(seed?: SeedInput): Scope {
    const child = new Scope(this._registry, undefined, [...this._middleware]);
    for (const [cellUnit, value] of this._cellValues.entries()) {
      child._knownCells.add(cellUnit);
      child._cellValues.set(cellUnit, value);
      child._cellVersions.set(cellUnit, this._cellVersions.get(cellUnit) ?? 0);
    }
    for (const id of this._hydratedIds) {
      child._hydratedIds.add(id);
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
  destroy(): void;
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
  checkpoint(name: string): void;
  restoreCheckpoint(name: string): boolean;
  deleteCheckpoint(name: string): boolean;
  listCheckpoints(): string[];
}

export interface HistoryOptions {
  limit?: number;
  track?: Cell<any>[];
  reasonPrefix?: string;
}

export function createStore(options: { seed?: SeedInput; middleware?: Middleware[] } = {}): Store {
  const registry = new StoreRegistry();
  const root = new Scope(registry, options.seed, options.middleware);

  return {
    root,
    fork(seed?: SeedInput): Scope {
      return root.fork(seed);
    },
    destroy(): void {
      root.destroy();
      registry.clear();
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

export function combine<const D extends ComputedDeps>(
  deps: D,
  options: { debugName?: string; cache?: 'scope' | 'none' } = {}
): Computed<{ [K in keyof D]: UnitValue<D[K]> }, D> {
  type Result = { [K in keyof D]: UnitValue<D[K]> };
  return computed<D, Result>(
    deps,
    ((...args: ComputedArgs<D>) => args as unknown as Result) as (...args: ComputedArgs<D>) => Result,
    options
  );
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
  const checkpoints = new Map<string, Map<AnyCell, unknown>>();
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
    checkpoint(name: string): void {
      const cells = trackedCells ? Array.from(trackedCells) : scope.listKnownCells();
      const snapshot = new Map<AnyCell, unknown>();
      for (const c of cells) {
        snapshot.set(c, scope.get(c));
      }
      checkpoints.set(name, snapshot);
    },
    restoreCheckpoint(name: string): boolean {
      const snapshot = checkpoints.get(name);
      if (!snapshot) return false;
      applying = true;
      try {
        scope.batch(() => {
          for (const [c, value] of snapshot.entries()) {
            scope.set(c, value, { priority: 'urgent', reason: `${reasonPrefix}.restore` });
          }
        });
      } finally {
        applying = false;
      }
      return true;
    },
    deleteCheckpoint(name: string): boolean {
      return checkpoints.delete(name);
    },
    listCheckpoints(): string[] {
      return Array.from(checkpoints.keys());
    },
  };
}

// --- Operators ---

export function merge<P>(
  events: Event<P>[],
  scope: Scope,
): { event: Event<P>; unsubscribe: Unsubscribe } {
  const merged = event<P>({ debugName: `merge(${events.length})` });
  const unsubscribers: Unsubscribe[] = [];

  for (const source of events) {
    unsubscribers.push(
      scope.on(source, (payload, s, opts) => {
        s.emit(merged, payload, opts);
      })
    );
  }

  return {
    event: merged,
    unsubscribe: () => {
      for (const unsub of unsubscribers) unsub();
    },
  };
}

export function split<P, K extends string>(
  source: Event<P>,
  scope: Scope,
  cases: Record<K, (payload: P) => boolean>,
): { [key in K]: Event<P> } & { unsubscribe: Unsubscribe } {
  const targets = {} as Record<K, Event<P>>;
  const keys = Object.keys(cases) as K[];

  for (const key of keys) {
    targets[key] = event<P>({ debugName: `split.${key}` });
  }

  const unsub = scope.on(source, (payload, s, opts) => {
    for (const key of keys) {
      if (cases[key](payload)) {
        s.emit(targets[key], payload, opts);
        return;
      }
    }
  });

  return Object.assign(targets, { unsubscribe: unsub });
}

export function guard<P>(
  source: Event<P>,
  scope: Scope,
  config: { filter: (payload: P) => boolean; target: Event<P> },
): Unsubscribe {
  return scope.on(source, (payload, s, opts) => {
    if (config.filter(payload)) {
      s.emit(config.target, payload, opts);
    }
  });
}

export interface SampleConfig<S, T> {
  clock: Event<any>;
  source: Cell<S> | Computed<S>;
  target: Event<T>;
  scope: Scope;
  filter?: (sourceValue: S) => boolean;
  fn?: (sourceValue: S) => T;
}

export function sample<S, T = S>(config: SampleConfig<S, T>): Unsubscribe {
  return config.scope.on(config.clock, (_payload, s, opts) => {
    const value = s.get(config.source);
    if (config.filter && !config.filter(value)) {
      return;
    }
    const output = config.fn ? config.fn(value) : value;
    s.emit(config.target, output as T, opts);
  });
}

export interface DebounceOptions {
  leading?: boolean;
}

export function debounce<P>(
  source: Event<P>,
  scope: Scope,
  delayMs: number,
  options: DebounceOptions = {},
): { event: Event<P>; unsubscribe: Unsubscribe } {
  const debounced = event<P>({ debugName: `debounce(${delayMs})` });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let canLead = true;

  const unsub = scope.on(source, (payload, s, opts) => {
    if (options.leading && canLead) {
      canLead = false;
      s.emit(debounced, payload, opts);
    }

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      canLead = true;
      if (!options.leading || !Object.is(payload, payload)) {
        s.emit(debounced, payload, opts);
      } else {
        // trailing: always emit last value
        s.emit(debounced, payload, opts);
      }
    }, delayMs);
  });

  return {
    event: debounced,
    unsubscribe: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      unsub();
    },
  };
}

export function throttle<P>(
  source: Event<P>,
  scope: Scope,
  intervalMs: number,
): { event: Event<P>; unsubscribe: Unsubscribe } {
  const throttled = event<P>({ debugName: `throttle(${intervalMs})` });
  let lastFired = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPayload: P | undefined;
  let lastOpts: UpdateOptions | undefined;
  let hasTrailing = false;

  const unsub = scope.on(source, (payload, s, opts) => {
    const now = Date.now();
    lastPayload = payload;
    lastOpts = opts;

    if (now - lastFired >= intervalMs) {
      lastFired = now;
      hasTrailing = false;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      s.emit(throttled, payload, opts);
    } else {
      hasTrailing = true;
      if (timer === undefined) {
        const remaining = intervalMs - (now - lastFired);
        timer = setTimeout(() => {
          timer = undefined;
          lastFired = Date.now();
          if (hasTrailing) {
            hasTrailing = false;
            s.emit(throttled, lastPayload as P, lastOpts ?? {});
          }
        }, remaining);
      }
    }
  });

  return {
    event: throttled,
    unsubscribe: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      unsub();
    },
  };
}

// --- Families ---

interface FamilyOptions<K> {
  isEqual?: (a: K, b: K) => boolean;
}

interface Family<K, U> {
  (key: K): U;
  remove(key: K): void;
  clear(): void;
}

function createFamily<K, U>(
  factory: (key: K) => U,
  options: FamilyOptions<K> = {},
): Family<K, U> {
  const cache: Array<{ key: K; unit: U }> = [];
  const isEqual = options.isEqual ?? Object.is;

  const find = (key: K): { key: K; unit: U } | undefined => {
    for (const entry of cache) {
      if (isEqual(entry.key, key)) return entry;
    }
    return undefined;
  };

  const family = ((key: K): U => {
    const existing = find(key);
    if (existing) return existing.unit;
    const unit = factory(key);
    cache.push({ key, unit });
    return unit;
  }) as Family<K, U>;

  family.remove = (key: K): void => {
    const idx = cache.findIndex((e) => isEqual(e.key, key));
    if (idx >= 0) cache.splice(idx, 1);
  };

  family.clear = (): void => {
    cache.length = 0;
  };

  return family;
}

export function cellFamily<K, T>(
  factory: (key: K) => Cell<T>,
  options?: FamilyOptions<K>,
): Family<K, Cell<T>> {
  return createFamily(factory, options);
}

export function computedFamily<K, T>(
  factory: (key: K) => Computed<T>,
  options?: FamilyOptions<K>,
): Family<K, Computed<T>> {
  return createFamily(factory, options);
}

export function eventFamily<K, P>(
  factory: (key: K) => Event<P>,
  options?: FamilyOptions<K>,
): Family<K, Event<P>> {
  return createFamily(factory, options);
}

export function effectFamily<K, P, R>(
  factory: (key: K) => Effect<P, R>,
  options?: FamilyOptions<K>,
): Family<K, Effect<P, R>> {
  return createFamily(factory, options);
}

// ---------------------------------------------------------------------------
// Observable interop
// ---------------------------------------------------------------------------

export interface Observable<T> {
  subscribe(observer: {
    next: (value: T) => void;
    error?: (err: unknown) => void;
    complete: () => void;
  }): { unsubscribe: () => void };
}

export function fromObservable<T>(
  observable: Observable<T>,
  initialValue: T,
  scope: Scope,
  meta?: UnitMeta,
): { unit: Cell<T>; unsubscribe: Unsubscribe } {
  const c = cell(initialValue, meta);
  const sub = observable.subscribe({
    next: (value) => scope.set(c, value),
    complete: () => {},
  });
  return {
    unit: c,
    unsubscribe: () => sub.unsubscribe(),
  };
}

export function toObservable<T>(
  unit: Cell<T> | Computed<T>,
  scope: Scope,
): Observable<T> {
  return {
    subscribe(observer) {
      // Emit current value immediately
      observer.next(scope.get(unit));

      let lastValue = scope.get(unit);
      const unsub = scope.subscribe((evt) => {
        if (unit.kind === 'cell') {
          for (const change of evt.changes) {
            if (change.kind === 'set' && change.unit === unit) {
              lastValue = change.next as T;
              observer.next(lastValue);
              return;
            }
          }
        } else {
          // For computed units, re-evaluate after dependency changes
          const nextValue = scope.get(unit);
          if (nextValue !== lastValue) {
            lastValue = nextValue;
            observer.next(nextValue);
          }
        }
      });

      return { unsubscribe: unsub };
    },
  };
}
