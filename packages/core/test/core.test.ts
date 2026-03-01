import { describe, expect, it } from 'vitest';

import { cell, computed, createStore, event } from '../src/index.js';

describe('core', () => {
  it('computed caches until dependency changes', () => {
    const n = cell(1, { id: 'n' });
    let runs = 0;
    const doubled = computed((ctx) => {
      runs += 1;
      return ctx.get(n) * 2;
    });

    const scope = createStore().fork();

    expect(scope.get(doubled)).toBe(2);
    expect(scope.get(doubled)).toBe(2);
    expect(runs).toBe(1);

    scope.set(n, 2);
    expect(scope.get(doubled)).toBe(4);
    expect(runs).toBe(2);
  });

  it('detects computed cycles', () => {
    const scope = createStore().fork();

    let a: ReturnType<typeof computed<number>>;
    let b: ReturnType<typeof computed<number>>;

    a = computed((ctx) => ctx.get(b) + 1);
    b = computed((ctx) => ctx.get(a) + 1);

    expect(() => scope.get(a)).toThrowError(/NS_CORE_CYCLE_DETECTED/);
  });

  it('batch emits one commit notification', () => {
    const a = cell(0, { id: 'a' });
    const b = cell(0, { id: 'b' });
    const scope = createStore().fork();

    const commits = [] as Array<{ changes: Array<{ kind: string }> }>;
    scope.subscribe((evt) => commits.push(evt));

    scope.batch(() => {
      scope.set(a, 1);
      scope.set(b, 2);
    });

    expect(commits).toHaveLength(1);
    expect(commits[0].changes.filter((x) => x.kind === 'set')).toHaveLength(2);
  });

  it('forked scopes are isolated', () => {
    const count = cell(0, { id: 'count' });
    const store = createStore();
    const s1 = store.fork();
    const s2 = store.fork();

    s1.set(count, 10);

    expect(s1.get(count)).toBe(10);
    expect(s2.get(count)).toBe(0);
  });

  it('event handlers can update state via emit', () => {
    const inc = event<number>({ debugName: 'inc' });
    const count = cell(0, { id: 'event_count' });
    const scope = createStore().fork();

    scope.on(inc, (payload, s) => {
      s.set(count, (prev) => prev + payload);
    });

    scope.emit(inc, 3);
    expect(scope.get(count)).toBe(3);
  });
});
