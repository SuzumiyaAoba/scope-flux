import { execSync } from 'node:child_process';

const iterations = Number(process.env.BENCH_ITERATIONS ?? '6000');
const derivedWidth = Number(process.env.BENCH_DERIVED_WIDTH ?? '300');
const minOpsPerSec = Number(process.env.BENCH_MIN_OPS_PER_SEC ?? '2000');

const command = `node packages/benchmark/dist/run.js --iterations=${iterations} --derived-width=${derivedWidth}`;
const output = execSync(command, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

process.stdout.write(output);

const lines = output.split('\n').filter((line) => line.includes('ops/sec='));
if (lines.length === 0) {
  throw new Error('NS_BENCH_OUTPUT_PARSE_FAILED');
}

for (const line of lines) {
  const nameMatch = line.trim().match(/^([a-zA-Z0-9._+\-]+)/);
  const opsMatch = line.match(/ops\/sec=([0-9.]+)/);
  if (!nameMatch || !opsMatch) {
    throw new Error(`NS_BENCH_OUTPUT_PARSE_FAILED:${line}`);
  }

  const name = nameMatch[1];
  const ops = Number(opsMatch[1]);
  if (!Number.isFinite(ops)) {
    throw new Error(`NS_BENCH_INVALID_OPS:${line}`);
  }
  if (ops < minOpsPerSec) {
    throw new Error(`NS_BENCH_REGRESSION:${name}:ops_per_sec=${ops}:threshold=${minOpsPerSec}`);
  }
}
