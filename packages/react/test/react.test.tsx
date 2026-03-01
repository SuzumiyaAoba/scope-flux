import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { cell, createStore, effect, event } from '@nexstate/core';
import { StoreProvider, useAction, useEffectAction, useUnit } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('react bridge', () => {
  it('throws when StoreProvider is missing', () => {
    const count = cell(0, { id: 'react_missing_provider_count' });

    function App(): React.JSX.Element {
      const value = useUnit(count);
      return <>{value}</>;
    }

    expect(() => {
      act(() => {
        create(<App />);
      });
    }).toThrowError(/NS_REACT_SCOPE_NOT_FOUND/);
  });

  it('useUnit selector avoids rerender when selected value is unchanged', () => {
    const state = cell({ a: 1, b: 1 }, { id: 'react_selector_state' });
    const scope = createStore().fork();
    let renders = 0;

    function Viewer(): React.JSX.Element {
      const a = useUnit(state, (v) => v.a);
      renders += 1;
      return <>{a}</>;
    }

    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <StoreProvider scope={scope}>
          <Viewer />
        </StoreProvider>
      );
    });

    act(() => {
      scope.set(state, { a: 1, b: 2 });
    });

    expect(renders).toBe(1);

    act(() => {
      scope.set(state, { a: 2, b: 2 });
    });

    expect(renders).toBe(2);
    act(() => {
      renderer!.unmount();
    });
  });

  it('useAction dispatches event updates', () => {
    const inc = event<number>({ debugName: 'react_inc' });
    const count = cell(0, { id: 'react_action_count' });
    const scope = createStore().fork();

    scope.on(inc, (payload, s) => {
      s.set(count, (prev) => prev + payload);
    });

    let fire!: (payload: number) => void;

    function App(): React.JSX.Element {
      fire = useAction(inc);
      const value = useUnit(count);
      return <>{value}</>;
    }

    act(() => {
      create(
        <StoreProvider scope={scope}>
          <App />
        </StoreProvider>
      );
    });

    act(() => {
      fire(3);
    });

    expect(scope.get(count)).toBe(3);
  });

  it('useEffectAction runs effect and updates state', async () => {
    const count = cell(0, { id: 'react_effect_count' });
    const setCountFx = effect<number, number>(async (payload, { scope }) => {
      scope.set(count, payload);
      return payload;
    });
    const scope = createStore().fork();

    let run!: (payload: number) => Promise<number>;

    function App(): React.JSX.Element {
      run = useEffectAction(setCountFx);
      const value = useUnit(count);
      return <>{value}</>;
    }

    act(() => {
      create(
        <StoreProvider scope={scope}>
          <App />
        </StoreProvider>
      );
    });

    let result = 0;
    await act(async () => {
      result = await run(7);
    });
    expect(result).toBe(7);
    expect(scope.get(count)).toBe(7);
  });
});
