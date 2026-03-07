# ErrorCodes

## Kind

- constant object

## Description

Namespace of error code strings used by the core package. Useful for matching errors in catch blocks.

## Values

| Key | Value | When |
|---|---|---|
| `DUPLICATE_STABLE_ID` | `NS_CORE_DUPLICATE_STABLE_ID` | Two cells share the same `id` |
| `INVALID_UPDATE` | `NS_CORE_INVALID_UPDATE` | Invalid unit passed to scope methods |
| `CYCLE_DETECTED` | `NS_CORE_CYCLE_DETECTED` | Circular dependency in `computed` |
| `MISSING_HANDLER` | `NS_CORE_MISSING_HANDLER` | `effect()` called without handler |
| `EFFECT_DROPPED` | `NS_CORE_EFFECT_DROPPED` | Effect dropped by `'drop'` concurrency |
| `EFFECT_ABORTED` | `NS_CORE_EFFECT_ABORTED` | Effect cancelled via `cancelEffect` or `destroy` |
| `EFFECT_TIMEOUT` | `NS_CORE_EFFECT_TIMEOUT` | Effect exceeded `timeoutMs` |
| `EFFECT_REPLACED` | `NS_CORE_EFFECT_REPLACED` | Effect replaced by `'replace'` concurrency |

## Related

- [core module index](/api/core)
