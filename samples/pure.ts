import { cell, computed, createStore, event, effect } from '@suzumiyaaoba/scope-flux-core';
import { createScheduler } from '@suzumiyaaoba/scope-flux-scheduler';
import { inspect } from '@suzumiyaaoba/scope-flux-inspect';
import { escapeJsonForHtml, hydrate, serialize } from '@suzumiyaaoba/scope-flux-serializer';

const count = cell(0, { id: 'samples.pure.count' });
const query = cell('', { id: 'samples.pure.query' });
const doubled = computed([count], (n) => n * 2, { debugName: 'doubled' });
const incremented = event<number>({ debugName: 'incremented' });
const addBonus = effect(async (value: number, { scope }) => {
  scope.set(count, (prev) => prev + value, { reason: 'bonus.apply' });
  return scope.get(count);
});

const scope = createStore().fork();
const scheduler = createScheduler({ scope });

scope.on(incremented, (delta, s) => {
  s.set(count, (prev) => prev + delta, { reason: 'event.incremented' });
});

const trace: string[] = [];
const stopInspect = inspect({
  scope,
  trace: true,
  sampleRate: 1,
  onRecord: (record) => {
    trace.push(`${record.trace.kind}:${record.trace.reason ?? '-'}`);
  },
});

scope.emit(incremented, 2, { reason: 'button.click' });
await scope.run(addBonus, 5, { reason: 'effect.run' });

scheduler.set(query, 'sc', { priority: 'transition', reason: 'typing.1' });
scheduler.set(query, (prev) => prev + 'ope', { priority: 'transition', reason: 'typing.2' });
console.log('[pure] query (buffered)=', scheduler.getBuffered<string>(query));
console.log('[pure] query (committed before flush)=', scheduler.getCommitted<string>(query));
scheduler.flushBuffered({ reason: 'input.blur' });

const payload = serialize(scope);
const escaped = escapeJsonForHtml(JSON.stringify(payload));

const hydratedScope = createStore().fork();
hydrate(hydratedScope, payload, { mode: 'safe' });

stopInspect();

console.log('[pure] count=', scope.get(count));
console.log('[pure] doubled=', scope.get(doubled));
console.log('[pure] query (committed after flush)=', scope.get(query));
console.log('[pure] payload.values=', payload.values);
console.log('[pure] escaped size=', escaped.length);
console.log('[pure] hydrated count=', hydratedScope.get(count));
console.log('[pure] trace=', trace);
