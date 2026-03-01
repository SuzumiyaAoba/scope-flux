import {
  type Cell,
  type Computed,
  type Effect,
  type Event,
  type Priority,
  type Scope,
} from '@nexstate/core';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

export interface StoreProviderProps {
  scope: Scope;
  children: ReactNode;
}

const StoreContext = createContext<Scope | null>(null);

export function StoreProvider({ scope, children }: StoreProviderProps): React.JSX.Element {
  return <StoreContext.Provider value={scope}>{children}</StoreContext.Provider>;
}

function useScope(): Scope {
  const scope = useContext(StoreContext);
  if (!scope) {
    throw new Error('NS_REACT_SCOPE_NOT_FOUND');
  }
  return scope;
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
