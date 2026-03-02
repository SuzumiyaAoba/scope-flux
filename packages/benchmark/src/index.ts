import { performance } from 'node:perf_hooks';

import { cell, computed, createStore } from '@suzumiyaaoba/scope-flux-core';
import { createScheduler } from '@suzumiyaaoba/scope-flux-scheduler';

export interface BenchmarkConfig {
  iterations: number;
  derivedWidth: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  elapsedMs: number;
  opsPerSec: number;
}

function heavyCompute(base: number, width: number): number {
  let v = base;
  for (let i = 0; i < width; i += 1) {
    v = (v * 1664525 + 1013904223) % 2147483647;
  }
  return v;
}

export function runCoreUrgentBenchmark(config: BenchmarkConfig): BenchmarkResult {
  const scope = createStore().fork();
  const source = cell(0);
  const derived = computed([source], (value) => heavyCompute(value, config.derivedWidth));

  const start = performance.now();
  for (let i = 0; i < config.iterations; i += 1) {
    scope.set(source, i, { priority: 'urgent' });
    scope.get(derived);
  }
  const elapsedMs = performance.now() - start;

  return {
    name: 'core.urgent',
    iterations: config.iterations,
    elapsedMs,
    opsPerSec: (config.iterations / elapsedMs) * 1000,
  };
}

export function runSchedulerBufferedBenchmark(config: BenchmarkConfig): BenchmarkResult {
  const scope = createStore().fork();
  const scheduler = createScheduler({ scope });
  const source = cell(0);
  const derived = computed([source], (value) => heavyCompute(value, config.derivedWidth));

  const start = performance.now();
  for (let i = 0; i < config.iterations; i += 1) {
    scheduler.set(source, i, { priority: 'transition' });
    if (i % 25 === 0) {
      scheduler.flushBuffered({ reason: 'benchmark.flush' });
      scope.get(derived);
    }
  }
  scheduler.flushBuffered({ reason: 'benchmark.finalFlush' });
  scope.get(derived);
  const elapsedMs = performance.now() - start;

  return {
    name: 'scheduler.transition+flush',
    iterations: config.iterations,
    elapsedMs,
    opsPerSec: (config.iterations / elapsedMs) * 1000,
  };
}

export function runBenchmarks(config: BenchmarkConfig): BenchmarkResult[] {
  return [runCoreUrgentBenchmark(config), runSchedulerBufferedBenchmark(config)];
}
