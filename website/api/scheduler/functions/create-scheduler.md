# createScheduler

## Signature

```ts
createScheduler(options: SchedulerOptions): Scheduler
```

## Description

Creates scheduler instance for a scope.

## Parameters

- `options.scope`: scope bound to this scheduler.

## Return Value

- Returns the value declared in the signature.
- For async APIs, handle the returned promise with `await` or `.then()`.

## Operational Notes

- Treat `reason` and stable IDs as part of your observability contract.
- Prefer small, composable calls and keep side effects at explicit boundaries.

## Example

```ts
import { cell, createStore } from '@scope-flux/core';
import { createScheduler } from '@scope-flux/scheduler';

const scope = createStore().fork();
const scheduler = createScheduler({ scope });
const query = cell('', { id: 'search.query' });

scheduler.set(query, 'sc', { priority: 'transition', reason: 'search.typing' });
console.log(scheduler.getBuffered(query)); // 'sc'
console.log(scheduler.getCommitted(query)); // ''

scheduler.flushBuffered({ reason: 'search.commit' });
console.log(scheduler.getCommitted(query)); // 'sc'
```

## Notes

- Use scheduler when interaction performance matters and staged updates are acceptable.
- Use `urgent` updates for values that must be committed immediately.

## Common Pitfalls

- Mixing domain events and UI-local state responsibilities in one layer.
- Omitting explicit IDs/reasons when debugging or serialization is required.
- Assuming buffered/async behavior is committed synchronously.

## Related

- [scheduler module index](/api/scheduler)
- [scheduler module guide](/api/scheduler)
- [Typedoc root](/typedoc/index.html)
