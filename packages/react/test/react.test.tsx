// @vitest-environment jsdom
import React, { act } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { cell, computed, createStore, effect, event, type Cell, type EffectStatus } from '@suzumiyaaoba/scope-flux-core';
import {
  useCell,
  StoreProvider,
  useAction,
  useAsyncEffectAction,
  useBufferedUnit,
  useCellAction,
  useEffectAction,
  useEffectStatus,
  useFlushBuffered,
  useHydrateUnits,
  useSetCell,
  useSuspenseEffectAction,
  useUnit,
  shallowEqual,
  useAutoCleanupEffect,
} from '../src/index.js';

afterEach(() => {
  cleanup();
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('react bridge', () => {
  it('throws when StoreProvider is missing', () => {
    const count = cell(0, { id: 'react_missing_provider_count' });

    function App(): React.JSX.Element {
      const value = useUnit(count);
      return <>{value}</>;
    }

    expect(() => render(<App />)).toThrowError(/NS_REACT_SCOPE_NOT_FOUND/);
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

    render(
      <StoreProvider scope={scope}>
        <Viewer />
      </StoreProvider>
    );

    act(() => {
      scope.set(state, { a: 1, b: 2 });
    });
    expect(renders).toBe(1);

    act(() => {
      scope.set(state, { a: 2, b: 2 });
    });
    expect(renders).toBe(2);
  });

  it('useUnit accepts computed unit and ignores unrelated updates', () => {
    const count = cell(1, { id: 'react_computed_count' });
    const other = cell(0, { id: 'react_computed_other' });
    const doubled = computed([count], (v) => v * 2);
    const scope = createStore().fork();
    let renders = 0;
    let seen = -1;

    function Viewer(): React.JSX.Element {
      seen = useUnit(doubled);
      renders += 1;
      return <>{seen}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <Viewer />
      </StoreProvider>
    );

    expect(seen).toBe(2);
    expect(renders).toBe(1);

    act(() => {
      scope.set(other, 1);
    });
    expect(renders).toBe(1);

    act(() => {
      scope.set(count, 2);
    });
    expect(seen).toBe(4);
    expect(renders).toBe(2);
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

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    act(() => {
      fire(3);
    });

    expect(scope.get(count)).toBe(3);
  });

  it('useAction defaults priority to urgent', () => {
    const ping = event<void>({ debugName: 'react_default_priority_event' });
    const scope = createStore().fork();
    let fire!: () => void;
    const commits: Array<{ priority: string }> = [];
    scope.subscribe((evt) => commits.push(evt as any));

    function App(): React.JSX.Element {
      fire = useAction(ping);
      return <></>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    act(() => {
      fire();
    });
    expect(commits[0].priority).toBe('urgent');
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

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    let result = 0;
    await act(async () => {
      result = await run(7);
    });
    expect(result).toBe(7);
    expect(scope.get(count)).toBe(7);
  });

  it('useEffectAction defaults priority to urgent', async () => {
    const fx = effect<void, void>(async () => {});
    const scope = createStore().fork();
    let run!: () => Promise<void>;
    const commits: Array<{ priority: string; changes: Array<{ kind: string }> }> = [];
    scope.subscribe((evt) => commits.push(evt as any));

    function App(): React.JSX.Element {
      run = useEffectAction(fx);
      return <></>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    await act(async () => {
      await run();
    });
    const effectCommit = commits.find((c) => c.changes[0]?.kind === 'effect');
    expect(effectCommit?.priority).toBe('urgent');
  });

  it('useCellAction with transition updates buffered value before commit', () => {
    const count = cell(0, { id: 'react_buffer_count' });
    const scope = createStore().fork();

    let setBuffered!: (next: number | ((prev: number) => number)) => void;
    let flush!: () => void;
    let bufferedSeen = -1;
    let committedSeen = -1;

    function App(): React.JSX.Element {
      setBuffered = useCellAction(count, { priority: 'transition' });
      flush = useFlushBuffered();
      bufferedSeen = useBufferedUnit(count);
      committedSeen = useUnit(count);
      return (
        <>
          {bufferedSeen}:{committedSeen}
        </>
      );
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    act(() => {
      setBuffered(5);
    });

    expect(bufferedSeen).toBe(5);
    expect(committedSeen).toBe(0);
    expect(scope.get(count)).toBe(0);

    act(() => {
      flush();
    });

    expect(scope.get(count)).toBe(5);
    expect(committedSeen).toBe(5);
  });

  it('useCell returns value and setter tuple', () => {
    const count = cell(0, { id: 'react_use_cell_count' });
    const scope = createStore().fork();

    let setCount!: (next: number | ((prev: number) => number)) => void;
    let seen = -1;

    function App(): React.JSX.Element {
      const [value, setValue] = useCell(count);
      seen = value;
      setCount = setValue;
      return <>{value}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    expect(seen).toBe(0);

    act(() => {
      setCount((prev) => prev + 3);
    });

    expect(scope.get(count)).toBe(3);
    expect(seen).toBe(3);
  });

  it('useSetCell returns a stable setter without reading value', () => {
    const count = cell(0, { id: 'react_use_set_cell_count' });
    const scope = createStore().fork();
    let setCount!: (next: number | ((prev: number) => number)) => void;
    let renders = 0;

    function App(): React.JSX.Element {
      setCount = useSetCell(count);
      renders += 1;
      return <>ok</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );
    expect(renders).toBe(1);

    act(() => {
      setCount((prev) => prev + 2);
    });
    expect(scope.get(count)).toBe(2);
    expect(renders).toBe(1);
  });

  it('useHydrateUnits hydrates id-less cells before first read', () => {
    const count = cell(0);
    const scope = createStore().fork();

    function App(): React.JSX.Element {
      useHydrateUnits([[count, 5]]);
      const value = useUnit(count);
      return <>{value}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    expect(screen.getByText('5')).toBeTruthy();
    expect(scope.get(count)).toBe(5);
  });

  it('useHydrateUnits hydrates each unit only once by default', () => {
    const count = cell(0);
    const scope = createStore().fork();

    function App({ value }: { value: number }): React.JSX.Element {
      useHydrateUnits([[count, value]]);
      return <>{useUnit(count)}</>;
    }

    const { rerender } = render(
      <StoreProvider scope={scope}>
        <App value={1} />
      </StoreProvider>
    );

    expect(scope.get(count)).toBe(1);

    act(() => {
      scope.set(count, 9);
    });
    expect(scope.get(count)).toBe(9);

    rerender(
      <StoreProvider scope={scope}>
        <App value={2} />
      </StoreProvider>
    );
    expect(scope.get(count)).toBe(9);
  });

  it('useHydrateUnits force option reapplies values', () => {
    const count = cell(0);
    const scope = createStore().fork();

    function App({ value }: { value: number }): React.JSX.Element {
      useHydrateUnits([[count, value]], { force: true });
      return <>{useUnit(count)}</>;
    }

    const { rerender } = render(
      <StoreProvider scope={scope}>
        <App value={1} />
      </StoreProvider>
    );
    expect(scope.get(count)).toBe(1);

    rerender(
      <StoreProvider scope={scope}>
        <App value={2} />
      </StoreProvider>
    );
    expect(scope.get(count)).toBe(2);
  });

  it('useHydrateUnits does not break when seed toggles between empty and non-empty', () => {
    const count = cell(0);
    const scope = createStore().fork();

    function App({ items }: { items: Array<readonly [Cell<any>, unknown]> }): React.JSX.Element {
      useHydrateUnits(items);
      const value = useUnit(count);
      return <span data-testid="value">{value}</span>;
    }

    const { rerender } = render(
      <StoreProvider scope={scope}>
        <App items={[[count, 10]]} />
      </StoreProvider>
    );
    expect(scope.get(count)).toBe(10);

    // Switching to empty seed must not throw a hooks violation error
    rerender(
      <StoreProvider scope={scope}>
        <App items={[]} />
      </StoreProvider>
    );
    expect(scope.get(count)).toBe(10);

    // Switching back to non-empty seed must not throw either
    rerender(
      <StoreProvider scope={scope}>
        <App items={[[count, 20]]} />
      </StoreProvider>
    );
  });

  it('useHydrateUnits treats function values as plain values', () => {
    const fnCell = cell<() => number>(() => 0);
    const scope = createStore().fork();

    function App(): React.JSX.Element {
      useHydrateUnits([[fnCell, () => 123]]);
      const fn = useUnit(fnCell);
      return <>{fn()}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    expect(scope.get(fnCell)()).toBe(123);
    expect(screen.getByText('123')).toBeTruthy();
  });

  it('useEffectStatus getSnapshot updates snapshotRef on value change', async () => {
    // Verifies that useExternalSelected's getSnapshot updates its internal
    // snapshot reference when the value changes, satisfying the
    // useSyncExternalStore contract: consecutive getSnapshot calls without
    // store changes must return the same reference.
    const scope = createStore().fork();
    const fx = effect<void, number>(async () => 42);
    const counter = cell(0, { id: 'react_status_snapshot_stability' });
    const statusRefs: Array<EffectStatus<number>> = [];

    function App(): React.JSX.Element {
      const status = useEffectStatus(fx);
      useUnit(counter); // subscribe so counter changes trigger re-render
      statusRefs.push(status);
      return <span>{status.running}</span>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    // Run and complete the effect — status transitions from
    // {running:0} → {running:1} → {running:0, lastResult:42}
    await act(async () => {
      await scope.run(fx, undefined);
    });

    const postEffectIdx = statusRefs.length - 1;
    const postEffectStatus = statusRefs[postEffectIdx];

    // Force a re-render via an unrelated cell change.
    // getSnapshot must return the SAME reference because the effect status
    // has not changed since the last render.
    act(() => {
      scope.set(counter, 1);
    });

    expect(statusRefs.length).toBeGreaterThan(postEffectIdx + 1);
    expect(statusRefs[statusRefs.length - 1]).toBe(postEffectStatus);
  });

  it('useEffectStatus reflects effect lifecycle', async () => {
    const scope = createStore().fork();
    let release!: () => void;
    const fx = effect<void, number>(() => {
      return new Promise<number>((resolve) => {
        release = () => resolve(9);
      });
    });

    let run!: () => Promise<number>;
    let running = -1;
    let lastResult: number | undefined;

    function App(): React.JSX.Element {
      run = useEffectAction(fx);
      const status = useEffectStatus(fx);
      running = status.running;
      lastResult = status.lastResult;
      return <>{running}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    let promise!: Promise<number>;
    await act(async () => {
      promise = run();
      await Promise.resolve();
    });
    expect(running).toBe(1);

    await act(async () => {
      release();
      await promise;
    });
    expect(running).toBe(0);
    expect(lastResult).toBe(9);
  });

  it('useAsyncEffectAction exposes run/cancel/status', async () => {
    const scope = createStore().fork();
    const fx = effect<void, number>(() => {
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(1), 30);
      });
    });

    let api!: ReturnType<typeof useAsyncEffectAction<void, number>>;

    function App(): React.JSX.Element {
      api = useAsyncEffectAction(fx);
      return <>{api.status.running}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    let promise!: Promise<number>;
    await act(async () => {
      promise = api.run();
      await Promise.resolve();
    });
    void promise.catch(() => {
      // handled below with explicit expectation
    });
    await act(async () => {
      api.cancel();
      await Promise.resolve();
    });
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('useSuspenseEffectAction read throws pending promise and returns resolved value', async () => {
    const scope = createStore().fork();
    let release!: () => void;
    const fx = effect<void, number>(() => {
      return new Promise<number>((resolve) => {
        release = () => resolve(11);
      });
    });

    let api!: ReturnType<typeof useSuspenseEffectAction<void, number>>;

    function App(): React.JSX.Element {
      api = useSuspenseEffectAction(fx);
      return <>{api.status.running}</>;
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    let promise!: Promise<number>;
    await act(async () => {
      promise = api.run();
      await Promise.resolve();
    });

    let thrown: unknown;
    try {
      api.read();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(promise);

    await act(async () => {
      release();
      await promise;
    });
    expect(api.read()).toBe(11);
  });

  it('supports user interaction flow with buffered input and flush button', () => {
    const query = cell('', { id: 'react_user_flow_query' });
    const scope = createStore().fork();

    function App(): React.JSX.Element {
      const value = useBufferedUnit(query);
      const setValue = useCellAction(query, { priority: 'transition' });
      const flush = useFlushBuffered();
      return (
        <div>
          <input
            aria-label="query"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button onClick={flush}>commit</button>
        </div>
      );
    }

    render(
      <StoreProvider scope={scope}>
        <App />
      </StoreProvider>
    );

    fireEvent.change(screen.getByLabelText('query'), { target: { value: 'abc' } });
    expect(scope.get(query)).toBe('');
    fireEvent.click(screen.getByText('commit'));
    expect(scope.get(query)).toBe('abc');
  });

  it('useBufferedUnit re-subscribes when unit prop changes', () => {
    const a = cell(0, { id: 'react_buffer_switch_a' });
    const b = cell(0, { id: 'react_buffer_switch_b' });
    const scope = createStore().fork();

    function App({ active }: { active: 'a' | 'b' }): React.JSX.Element {
      const unit = active === 'a' ? a : b;
      const value = useBufferedUnit(unit);
      return <span data-testid="value">{value}</span>;
    }

    const view = render(
      <StoreProvider scope={scope}>
        <App active="a" />
      </StoreProvider>
    );

    act(() => {
      scope.set(a, 1);
    });
    expect(screen.getByTestId('value').textContent).toBe('1');

    view.rerender(
      <StoreProvider scope={scope}>
        <App active="b" />
      </StoreProvider>
    );

    act(() => {
      scope.set(a, 2);
    });
    expect(screen.getByTestId('value').textContent).toBe('0');

    act(() => {
      scope.set(b, 3);
    });
    expect(screen.getByTestId('value').textContent).toBe('3');
  });

  describe('shallowEqual', () => {
    it('returns true for identical references', () => {
      const obj = { a: 1 };
      expect(shallowEqual(obj, obj)).toBe(true);
    });

    it('returns true for objects with same keys and values', () => {
      expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    });

    it('returns false for different values', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('returns false for different number of keys', () => {
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('returns true for equal arrays', () => {
      expect(shallowEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('returns false for different arrays', () => {
      expect(shallowEqual([1, 2], [1, 3])).toBe(false);
    });

    it('returns true for primitives', () => {
      expect(shallowEqual(42, 42)).toBe(true);
      expect(shallowEqual('a', 'a')).toBe(true);
    });

    it('handles null and undefined', () => {
      expect(shallowEqual(null, null)).toBe(true);
      expect(shallowEqual(null, undefined)).toBe(false);
    });
  });

  it('useUnit with selector and shallowEqual prevents re-renders for equivalent objects', () => {
    const user = cell({ name: 'John', age: 30, extra: 'x' }, { id: 'shallow_user' });
    const store = createStore();
    const scope = store.root;
    let renderCount = 0;

    function NameDisplay() {
      renderCount++;
      const coords = useUnit(user, (u) => ({ name: u.name }), { equality: shallowEqual });
      return <div data-testid="name">{coords.name}</div>;
    }

    render(
      <StoreProvider scope={scope}>
        <NameDisplay />
      </StoreProvider>
    );
    expect(renderCount).toBe(1);
    expect(screen.getByTestId('name').textContent).toBe('John');

    // Change a non-selected field — should NOT re-render
    act(() => {
      scope.set(user, { name: 'John', age: 31, extra: 'y' });
    });
    expect(renderCount).toBe(1);

    // Change the selected field — should re-render
    act(() => {
      scope.set(user, { name: 'Jane', age: 31, extra: 'y' });
    });
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('name').textContent).toBe('Jane');
  });

  describe('useAutoCleanupEffect', () => {
    it('cancels effect on unmount', async () => {
      let started = 0;
      let completed = 0;
      const fx = effect(async (_: void, { signal }) => {
        started++;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 100);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('AbortError'));
          });
        });
        completed++;
        return 'done';
      });

      const store = createStore();
      const scope = store.root;

      function TestComp() {
        const { run } = useAutoCleanupEffect(fx);
        React.useEffect(() => {
          // Catch the abort error to prevent unhandled rejection
          run(undefined).catch(() => {});
        }, [run]);
        return <div>test</div>;
      }

      const { unmount } = render(
        <StoreProvider scope={scope}>
          <TestComp />
        </StoreProvider>
      );

      expect(started).toBe(1);
      unmount();

      // Wait a tick to let cancellation propagate
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });

      expect(completed).toBe(0); // effect was cancelled
    });

    it('returns run and cancel functions', () => {
      const fx = effect(async (_: string) => 'result');
      const store = createStore();
      const scope = store.root;

      function TestComp() {
        const { run, cancel, status } = useAutoCleanupEffect(fx);
        return (
          <div>
            <span data-testid="running">{status.running}</span>
            <button data-testid="run" onClick={() => run('test')}>Run</button>
            <button data-testid="cancel" onClick={() => cancel()}>Cancel</button>
          </div>
        );
      }

      render(
        <StoreProvider scope={scope}>
          <TestComp />
        </StoreProvider>
      );

      expect(screen.getByTestId('running').textContent).toBe('0');
    });
  });
});
