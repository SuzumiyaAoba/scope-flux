import {
  type Cell,
  type Computed,
  type Effect,
  type Event,
  type Priority,
  type Scope,
} from '@scope-flux/core';
import { createScheduler, type Scheduler } from '@scope-flux/scheduler';
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
  const equality = (options?.equality ?? Object.is) as (a: T | S, b: T | S) => boolean;

  const readSelected = useCallback((): T | S => {
    const value = scope.get(unit);
    if (selector) {
      return selector(value);
    }
    return value;
  }, [scope, unit, selector]);

  const snapshotRef = useRef<T | S>(readSelected());

  const getSnapshot = useCallback(() => {
    const next = readSelected();
    if (equality(snapshotRef.current, next)) {
      return snapshotRef.current;
    }
    snapshotRef.current = next;
    return next;
  }, [readSelected, equality]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return scope.subscribe(() => {
        const next = readSelected();
        if (!equality(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });
    },
    [scope, readSelected, equality]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  const equality = (options?.equality ?? Object.is) as (a: T | S, b: T | S) => boolean;

  const readSelected = useCallback((): T | S => {
    const value = scheduler.getBuffered<T>(unit as any);
    if (selector) {
      return selector(value);
    }
    return value;
  }, [scheduler, unit, selector]);

  const snapshotRef = useRef<T | S>(readSelected());

  const getSnapshot = useCallback(() => {
    const next = readSelected();
    if (equality(snapshotRef.current, next)) {
      return snapshotRef.current;
    }
    snapshotRef.current = next;
    return next;
  }, [readSelected, equality]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubScope = scope.subscribe(() => {
        const next = readSelected();
        if (!equality(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });

      const unsubBuffered = scheduler.subscribeBuffered(() => {
        const next = readSelected();
        if (!equality(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });

      return () => {
        unsubScope();
        unsubBuffered();
      };
    },
    [scope, scheduler, readSelected, equality]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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

        scheduler.set(cell as any, next as any, {
          priority,
          reason: options?.reason,
        });
      },
    [scope, scheduler, cell, priority, options?.reason]
  );
}

export function useFlushBuffered(): () => void {
  const scheduler = useScheduler();

  return useMemo(
    () =>
      () => {
        scheduler.flushBuffered();
      },
    [scheduler]
  );
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
