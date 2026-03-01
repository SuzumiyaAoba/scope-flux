# createScheduler

## Signature

```ts
createScheduler(options: SchedulerOptions): Scheduler
```

## Description

Creates scheduler instance for a scope.

## Parameters

- `options.scope`: scope bound to this scheduler.

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

## Related

- [scheduler module index](/api/scheduler)
- [scheduler module guide](/api/scheduler)
- [Typedoc root](/typedoc/index.html)
