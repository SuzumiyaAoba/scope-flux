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

export interface EffectContext {
  scope: Scope;
}

export type ScopeListener = (evt: CommitEvent) => void;
export type Unsubscribe = () => void;

export interface Cell<T> {
  kind: 'cell';
  init: T;
  meta: UnitMeta;
  equal?: (a: T, b: T) => boolean;
  readonly __type?: T;
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
  meta: UnitMeta;
}

export type AnyCell = Cell<any>;
export type AnyComputed = Computed<any, ComputedDeps>;

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

export type SeedInput = Map<AnyCell, unknown> | Array<readonly [AnyCell, unknown]>;

const registeredCellsById = new Map<string, AnyCell>();

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defaultEqual<T>(a: T, b: T): boolean {
  return Object.is(a, b);
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

  if (unit.meta.id) {
    const existing = registeredCellsById.get(unit.meta.id);
    if (existing && existing !== unit) {
      throw new Error(`NS_CORE_DUPLICATE_STABLE_ID:${unit.meta.id}`);
    }
    registeredCellsById.set(unit.meta.id, unit as AnyCell);
  }

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
  options: { debugName?: string } = {}
): Effect<P, R> {
  if (typeof handler !== 'function') {
    throw new Error('NS_CORE_MISSING_HANDLER');
  }

  return {
    kind: 'effect',
    handler,
    meta: {
      debugName: options.debugName,
    },
  };
}

export class Scope {
  private static _nextId = 0;
  public readonly id: string;

  private readonly _cellValues = new Map<AnyCell, unknown>();
  private readonly _cellVersions = new Map<AnyCell, number>();
  private readonly _computedVersions = new Map<AnyComputed, number>();
  private readonly _computedCache = new Map<AnyComputed, ComputedCacheEntry>();
  private readonly _subscribers = new Set<ScopeListener>();
  private readonly _eventHandlers = new Map<Event<unknown>, Set<(payload: unknown, scope: Scope, options: UpdateOptions) => void>>();
  private readonly _knownCells = new Set<AnyCell>();
  private readonly _hydratedIds = new Set<string>();

  private _batchDepth = 0;
  private _pendingChanges: Change[] = [];
  private _pendingPriority: Priority | undefined;

  constructor(seed?: SeedInput) {
    this.id = `scope_${Scope._nextId++}`;
    if (seed) {
      this._applySeed(seed);
    }
  }

  private _applySeed(seed: SeedInput): void {
    const applyCellValue = (unit: AnyCell, value: unknown) => {
      if (!unit || unit.kind !== 'cell') {
        throw new Error('NS_CORE_INVALID_UPDATE');
      }
      this._knownCells.add(unit);
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

    throw new Error('NS_CORE_INVALID_UPDATE');
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
  }

  private _withBatch<T>(fn: () => T): T {
    this._batchDepth += 1;
    const prevLength = this._pendingChanges.length;
    const prevPriority = this._pendingPriority;
    try {
      const result = fn();
      this._batchDepth -= 1;
      if (this._batchDepth === 0) {
        this._flush();
      }
      return result;
    } catch (error) {
      this._batchDepth -= 1;
      const rolledBack = this._pendingChanges.splice(prevLength);
      this._pendingPriority = prevPriority;
      const cellSnapshots = new Map<AnyCell, { value: unknown; version: number }>();
      for (const change of rolledBack) {
        if (change.kind === 'set') {
          const c = change.unit;
          if (!cellSnapshots.has(c)) {
            cellSnapshots.set(c, {
              value: change.prev,
              version: (this._cellVersions.get(c) ?? 1) - 1,
            });
          }
        }
      }
      for (const [c, snap] of cellSnapshots) {
        if (snap.version <= 0) {
          this._cellValues.delete(c);
          this._cellVersions.delete(c);
        } else {
          this._cellValues.set(c, snap.value);
          this._cellVersions.set(c, snap.version);
        }
      }
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

    this._knownCells.add(unit as AnyCell);
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
      throw new Error('NS_CORE_CYCLE_DETECTED');
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
      throw new Error('NS_CORE_INVALID_UPDATE');
    }

    if (unit.kind === 'cell') {
      const c = unit as AnyCell;
      this._knownCells.add(c);
      if (this._cellValues.has(c)) {
        return this._cellValues.get(c) as T;
      }
      return unit.init;
    }

    if (unit.kind === 'computed') {
      return this._getComputed(unit);
    }

    throw new Error('NS_CORE_INVALID_UPDATE');
  }

  public set<T>(unit: Cell<T>, next: T | ((prev: T) => T), options: UpdateOptions = {}): void {
    if (!unit || unit.kind !== 'cell') {
      throw new Error('NS_CORE_INVALID_UPDATE');
    }

    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(this.get(unit)) : next;

    this._withBatch(() => {
      this._setCellValue(unit, resolved, options);
    });
  }

  public batch<T>(fn: () => T): T {
    return this._withBatch(fn);
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

  public async run<P, R>(unitEffect: Effect<P, R>, payload: P, options: UpdateOptions = {}): Promise<R> {
    if (!unitEffect || unitEffect.kind !== 'effect') {
      throw new Error('NS_CORE_INVALID_UPDATE');
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

    return await unitEffect.handler(payload, { scope: this });
  }

  public subscribe(listener: ScopeListener): Unsubscribe {
    this._subscribers.add(listener);
    return () => {
      this._subscribers.delete(listener);
    };
  }

  public fork(seed?: SeedInput): Scope {
    const child = new Scope();
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

  public _listKnownCells(): AnyCell[] {
    return Array.from(this._knownCells);
  }

  public _isHydrated(id: string): boolean {
    return this._hydratedIds.has(id);
  }

  public _markHydrated(id: string): void {
    this._hydratedIds.add(id);
  }
}

export interface Store {
  root: Scope;
  fork(seed?: SeedInput): Scope;
}

export function createStore(options: { seed?: SeedInput } = {}): Store {
  const root = new Scope(options.seed);

  return {
    root,
    fork(seed?: SeedInput): Scope {
      return root.fork(seed);
    },
  };
}

export function getRegisteredCellById(id: string): AnyCell | undefined {
  return registeredCellsById.get(id);
}

export function listRegisteredCells(): AnyCell[] {
  return Array.from(registeredCellsById.values());
}
