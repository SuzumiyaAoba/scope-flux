import {
  type Cell,
  type Computed,
  type Effect,
  type Event,
  type Priority,
  type Scope,
} from '@suzumiyaaoba/scope-flux-core';
import { createScheduler, type Scheduler } from '@suzumiyaaoba/scope-flux-scheduler';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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
    snapshotRef.current = next;
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
  readDeps: readonly unknown[],
  subscribe: (onStoreChange: () => void) => () => void,
  selector?: (value: T) => S,
  equality?: (a: S, b: S) => boolean,
): T | S {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSelected = useCallback((): T | S => {
    const value = readValue();
    return selectorRef.current ? selectorRef.current(value) : value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, readDeps);

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
    (onStoreChange: () => void) => scope.subscribe(onStoreChange),
    [scope]
  );

  return useSelectedUnit(
    () => scope.get(unit),
    [scope, unit],
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
      const unsubScope = scope.subscribe(onStoreChange);
      const unsubBuffered = scheduler.subscribeBuffered(onStoreChange);
      return () => {
        unsubScope();
        unsubBuffered();
      };
    },
    [scope, scheduler]
  );

  return useSelectedUnit(
    () => scheduler.getBuffered<T>(unit),
    [scheduler, unit],
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

  return useMemo(
    () =>
      (next: T | ((prev: T) => T)) => {
        if (priority === 'urgent') {
          scope.set(cell, next, {
            priority,
            reason: options?.reason,
          });
          return;
        }

        scheduler.set(cell, next, {
          priority,
          reason: options?.reason,
        });
      },
    [scope, scheduler, cell, priority, options?.reason]
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

export function useFlushBuffered(): () => void {
  const scheduler = useScheduler();
  return useCallback(() => scheduler.flushBuffered(), [scheduler]);
}

export function useAction<P>(
  unitEvent: Event<P>,
  options?: { priority?: Priority }
): (payload: P) => void {
  const scope = useScope();
  const priority = options?.priority;

  return useMemo(
    () =>
      (payload: P) => {
        scope.emit(unitEvent, payload, {
          priority,
        });
      },
    [scope, unitEvent, priority]
  );
}

export function useEffectAction<P, R>(
  unitEffect: Effect<P, R>,
  options?: { priority?: Priority }
): (payload: P) => Promise<R> {
  const scope = useScope();
  const priority = options?.priority;

  return useMemo(
    () =>
      async (payload: P): Promise<R> => {
        return scope.run(unitEffect, payload, {
          priority,
        });
      },
    [scope, unitEffect, priority]
  );
}
