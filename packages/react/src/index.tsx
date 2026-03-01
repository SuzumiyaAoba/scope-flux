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

function useExternalSelected<T>(options: {
  getValue: () => T;
  subscribe: (onStoreChange: () => void) => () => void;
  equality?: (a: T, b: T) => boolean;
}): T {
  const equality = options.equality ?? Object.is;
  const snapshotRef = useRef<T>(options.getValue());

  const getSnapshot = useCallback(() => {
    const next = options.getValue();
    if (equality(snapshotRef.current, next)) {
      return snapshotRef.current;
    }
    snapshotRef.current = next;
    return next;
  }, [options, equality]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return options.subscribe(() => {
        const next = options.getValue();
        if (!equality(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      });
    },
    [options, equality]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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

  const getSelected = useCallback((): T | S => {
    const value = scope.get(unit);
    return selector ? selector(value) : value;
  }, [scope, unit, selector]);

  return useExternalSelected({
    getValue: getSelected,
    subscribe: (onStoreChange) => scope.subscribe(onStoreChange),
    equality: options?.equality as ((a: T | S, b: T | S) => boolean) | undefined,
  });
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

  const getSelected = useCallback((): T | S => {
    const value = scheduler.getBuffered<T>(unit as any);
    return selector ? selector(value) : value;
  }, [scheduler, unit, selector]);

  return useExternalSelected({
    getValue: getSelected,
    subscribe: (onStoreChange) => {
      const unsubScope = scope.subscribe(onStoreChange);
      const unsubBuffered = scheduler.subscribeBuffered(onStoreChange);
      return () => {
        unsubScope();
        unsubBuffered();
      };
    },
    equality: options?.equality as ((a: T | S, b: T | S) => boolean) | undefined,
  });
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
