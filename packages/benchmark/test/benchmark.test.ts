import { describe, expect, it } from 'vitest';

import {
  runBenchmarks,
  runCoreUrgentBenchmark,
  runSchedulerBufferedBenchmark,
} from '../src/index.js';

describe('benchmark', () => {
  it('runCoreUrgentBenchmark returns a valid result shape', () => {
    const result = runCoreUrgentBenchmark({ iterations: 50, derivedWidth: 10 });

    expect(result.name).toBe('core.urgent');
    expect(result.iterations).toBe(50);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.opsPerSec)).toBe(true);
  });

  it('runSchedulerBufferedBenchmark returns a valid result shape', () => {
    const result = runSchedulerBufferedBenchmark({ iterations: 60, derivedWidth: 10 });

    expect(result.name).toBe('scheduler.transition+flush');
    expect(result.iterations).toBe(60);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.opsPerSec)).toBe(true);
  });

  it('runBenchmarks returns both benchmark results', () => {
    const results = runBenchmarks({ iterations: 20, derivedWidth: 5 });

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('core.urgent');
    expect(results[1].name).toBe('scheduler.transition+flush');
  });
});
