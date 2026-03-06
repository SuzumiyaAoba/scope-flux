import { asValue } from '@suzumiyaaoba/scope-flux-core';
import type { Cell, Computed, Effect, EffectStatus, Event, Priority, Scope, SeedInput } from '@suzumiyaaoba/scope-flux-core';
import { createScheduler, type Scheduler } from '@suzumiyaaoba/scope-flux-scheduler';
import type React from 'react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

interface StoreContextValue {
  scope: Scope;
  scheduler: Scheduler;
}

export interface StoreProviderProps {
  scope: Scope;
  scheduler?: Scheduler;
  children: ReactNode;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ scope, scheduler, children }: StoreProviderProps): React.JSX.Element {
  const value = useMemo<StoreContextValue>(() => {
    return {
      scope,
      scheduler: scheduler ?? createScheduler({ scope }),
    };
  }, [scope, scheduler]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStoreContext(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error('NS_REACT_SCOPE_NOT_FOUND');
  }
  return value;
}

function useScope(): Scope {
  return useStoreContext().scope;
}

function useScheduler(): Scheduler {
  return useStoreContext().scheduler;
}

function seedToEntries(seed: SeedInput): Array<readonly [Cell<any>, unknown]> {
  return seed instanceof Map ? Array.from(seed.entries()) : seed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function markSeen(
  seen: WeakMap<object, WeakSet<object>>,
  left: object,
  right: object,
): boolean {
  const existing = seen.get(left);
  if (existing?.has(right)) {
    return true;
  }
  if (existing) {
    existing.add(right);
    return false;
  }
  seen.set(left, new WeakSet([right]));
  return false;
}

function seedValueEqual(
  left: unknown,
  right: unknown,
  seen: WeakMap<object, WeakSet<object>> = new WeakMap(),
): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    if (markSeen(seen, left, right)) {
      return true;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!seedValueEqual(left[index], right[index], seen)) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    if (markSeen(seen, left, right)) {
      return true;
    }
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key) || !seedValueEqual(left[key], right[key], seen)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function seedEntriesEqual(
  left: Array<readonly [Cell<any>, unknown]>,
  right: Array<readonly [Cell<any>, unknown]>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const [leftUnit, leftValue] = left[index];
    const [rightUnit, rightValue] = right[index];
    if (leftUnit !== rightUnit || !seedValueEqual(leftValue, rightValue)) {
      return false;
    }
  }

  return true;
}

function useExternalSelected<T>(options: {
  getValue: () => T;
  subscribe: (onStoreChange: () => void) => () => void;
  equality?: (a: T, b: T) => boolean;
}): T {
  const { getValue, subscribe: subscribeFn } = options;
  const equality = options.equality ?? Object.is;
  const snapshotRef = useRef<T>(getValue());
  const getValueRef = useRef(getValue);
  getValueRef.current = getValue;
  const equalityRef = useRef(equality);
  equalityRef.current = equality;

  const getSnapshot = useCallback(() => {
    const next = getValueRef.current();
    if (equalityRef.current(snapshotRef.current, next)) {
      return snapshotRef.current;
    }
    return next;
  }, []);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return subscribeFn(() => {
        const next = getValueRef.current();
        if (!equalityRef.current(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });
    },
    [subscribeFn]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useSelectedUnit<T, S>(
  readValue: () => T,
  subscribe: (onStoreChange: () => void) => () => void,
  selector?: (value: T) => S,
  equality?: (a: S, b: S) => boolean,
): T | S {
  const readValueRef = useRef(readValue);
  readValueRef.current = readValue;
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSelected = useCallback((): T | S => {
    const value = readValueRef.current();
    return selectorRef.current ? selectorRef.current(value) : value;
  }, []);

  return useExternalSelected({
    getValue: getSelected,
    subscribe,
    equality: equality as ((a: T | S, b: T | S) => boolean) | undefined,
  });
}

export function useUnit<T>(unit: Cell<T> | Computed<T>): T;
export function useUnit<T, S>(
  unit: Cell<T> | Computed<T>,
  selector: (value: T) => S,
  options?: { equality?: (a: S, b: S) => boolean }
): S;
export function useUnit<T, S>(
  unit: Cell<T> | Computed<T>,
  selector?: (value: T) => S,
  options?: { equality?: (a: S, b: S) => boolean }
): T | S {
  const scope = useScope();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return scope.subscribeUnit(unit, onStoreChange);
    },
    [scope, unit]
  );

  return useSelectedUnit(
    () => scope.get(unit),
    subscribe,
    selector,
    options?.equality,
  );
}

export function useBufferedUnit<T>(unit: Cell<T>): T;
export function useBufferedUnit<T, S>(
  unit: Cell<T>,
  selector: (value: T) => S,
  options?: { equality?: (a: S, b: S) => boolean }
): S;
export function useBufferedUnit<T, S>(
  unit: Cell<T>,
  selector?: (value: T) => S,
  options?: { equality?: (a: S, b: S) => boolean }
): T | S {
  const scope = useScope();
  const scheduler = useScheduler();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubScope = scope.subscribeUnit(unit, onStoreChange);
      const unsubBuffered = scheduler.subscribeBuffered(onStoreChange);
      return () => {
        unsubScope();
        unsubBuffered();
      };
    },
    [scope, scheduler, unit]
  );

  return useSelectedUnit(
    () => scheduler.getBuffered<T>(unit),
    subscribe,
    selector,
    options?.equality,
  );
}

export function useCellAction<T>(
  cell: Cell<T>,
  options?: { priority?: Priority; reason?: string }
): (next: T | ((prev: T) => T)) => void {
  const scope = useScope();
  const scheduler = useScheduler();
  const priority = options?.priority ?? 'urgent';
  const reasonRef = useRef(options?.reason);
  reasonRef.current = options?.reason;

  return useMemo(
    () =>
      (next: T | ((prev: T) => T)) => {
        if (priority === 'urgent') {
          scope.set(cell, next, {
            priority,
            reason: reasonRef.current,
          });
          return;
        }

        scheduler.set(cell, next, {
          priority,
          reason: reasonRef.current,
        });
      },
    [scope, scheduler, cell, priority]
  );
}

export function useCell<T>(
  cell: Cell<T>,
  options?: { priority?: Priority; reason?: string }
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useUnit(cell);
  const setValue = useCellAction(cell, options);
  return [value, setValue];
}

export function useSetCell<T>(
  cell: Cell<T>,
  options?: { priority?: Priority; reason?: string }
): (next: T | ((prev: T) => T)) => void {
  return useCellAction(cell, options);
}

export function useFlushBuffered(): () => void {
  const scheduler = useScheduler();
  return useCallback(() => scheduler.flushBuffered(), [scheduler]);
}

export function useAction<P>(
  unitEvent: Event<P>,
  options?: { priority?: Priority; reason?: string }
): (payload: P) => void {
  const scope = useScope();
  const priority = options?.priority ?? 'urgent';
  const reasonRef = useRef(options?.reason);
  reasonRef.current = options?.reason;

  return useMemo(
    () =>
      (payload: P) => {
        scope.emit(unitEvent, payload, {
          priority,
          reason: reasonRef.current,
        });
      },
    [scope, unitEvent, priority]
  );
}

export function useEffectAction<P, R>(
  unitEffect: Effect<P, R>,
  options?: { priority?: Priority; reason?: string }
): (payload: P) => Promise<R> {
  const scope = useScope();
  const priority = options?.priority ?? 'urgent';
  const reasonRef = useRef(options?.reason);
  reasonRef.current = options?.reason;

  return useMemo(
    () =>
      async (payload: P): Promise<R> => {
        return scope.run(unitEffect, payload, {
          priority,
          reason: reasonRef.current,
        });
      },
    [scope, unitEffect, priority]
  );
}

export function useEffectStatus<P, R>(unitEffect: Effect<P, R>): EffectStatus<R> {
  const scope = useScope();
  return useExternalSelected({
    getValue: () => scope.getEffectStatus(unitEffect),
    subscribe: (onStoreChange) => scope.subscribeEffectStatus(unitEffect, onStoreChange),
    equality: (a, b) =>
      a.running === b.running &&
      a.queued === b.queued &&
      Object.is(a.lastError, b.lastError) &&
      Object.is(a.lastResult, b.lastResult) &&
      a.lastStartedAt === b.lastStartedAt &&
      a.lastFinishedAt === b.lastFinishedAt,
  });
}

export function useAsyncEffectAction<P, R>(
  unitEffect: Effect<P, R>,
  options?: { priority?: Priority; reason?: string }
): {
  run: (payload: P) => Promise<R>;
  cancel: () => void;
  status: EffectStatus<R>;
} {
  const scope = useScope();
  const run = useEffectAction(unitEffect, options);
  const status = useEffectStatus(unitEffect);
  const cancel = useCallback(() => {
    scope.cancelEffect(unitEffect);
  }, [scope, unitEffect]);
  return {
    run,
    cancel,
    status,
  };
}

export function useSuspenseEffectAction<P, R>(
  unitEffect: Effect<P, R>,
  options?: { priority?: Priority; reason?: string }
): {
  run: (payload: P) => Promise<R>;
  cancel: () => void;
  status: EffectStatus<R>;
  read: () => R | undefined;
} {
  const scope = useScope();
  const status = useEffectStatus(unitEffect);
  const inFlightRef = useRef<Promise<R> | null>(null);
  const runBase = useEffectAction(unitEffect, options);
  const run = useMemo(
    () =>
      (payload: P) => {
        const current = runBase(payload);
        inFlightRef.current = current;
        void current.finally(() => {
          if (inFlightRef.current === current) {
            inFlightRef.current = null;
          }
        });
        return current;
      },
    [runBase]
  );
  const cancel = useCallback(() => {
    scope.cancelEffect(unitEffect);
  }, [scope, unitEffect]);
  const read = useCallback(() => {
    if (status.lastError) {
      throw status.lastError;
    }
    if (status.running > 0 && inFlightRef.current) {
      throw inFlightRef.current;
    }
    return status.lastResult;
  }, [status]);

  return {
    run,
    cancel,
    status,
    read,
  };
}

export function useHydrateUnits(seed: SeedInput, options?: { force?: boolean }): void {
  const scope = useScope();
  const hydratedRef = useRef(new WeakMap<Scope, WeakSet<Cell<any>>>());
  const forcedSeedRef = useRef(new WeakMap<Scope, Array<readonly [Cell<any>, unknown]>>());
  const force = options?.force ?? false;

  const entries = seedToEntries(seed);
  if (entries.length === 0) {
    return;
  }

  let seenUnits = hydratedRef.current.get(scope);
  if (!seenUnits) {
    seenUnits = new WeakSet<Cell<any>>();
    hydratedRef.current.set(scope, seenUnits);
  }

  const hydrateUnits = (forceApply: boolean) => {
    scope.batch(() => {
      for (const [unit, value] of entries) {
        if (!unit || unit.kind !== 'cell') {
          throw new Error('NS_CORE_INVALID_UPDATE');
        }
        if (!forceApply && seenUnits.has(unit)) {
          continue;
        }
        scope.set(unit, asValue(value), { priority: 'urgent', reason: 'hydrate' });
        if (unit.meta?.id) {
          scope.markHydrated(unit.meta.id);
        }
        seenUnits.add(unit);
      }
    });
  };

  if (!force) {
    hydrateUnits(false);
  }

  useEffect(() => {
    if (!force) {
      return;
    }
    const prevEntries = forcedSeedRef.current.get(scope);
    if (prevEntries && seedEntriesEqual(prevEntries, entries)) {
      return;
    }
    hydrateUnits(true);
    forcedSeedRef.current.set(scope, entries.map(([unit, value]) => [unit, value] as const));
  });
}
