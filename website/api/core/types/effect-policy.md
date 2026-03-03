# EffectPolicy

## Kind

- interface

## Description

Configures effect execution behavior.

Fields:

- `concurrency?: 'parallel' | 'drop' | 'replace' | 'queue'`
- `retries?: number`
- `retryDelayMs?: number | ((attempt: number, error: unknown) => number)`

## Notes

- `drop`: reject new run while already running.
- `replace`: abort running tasks and start latest.
- `queue`: enqueue and run sequentially.

## Related

- [core module index](/api/core)
- [Typedoc root](/typedoc/index.html)
