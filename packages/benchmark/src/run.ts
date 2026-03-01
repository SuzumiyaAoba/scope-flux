import { runBenchmarks, type BenchmarkConfig } from './index.js';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.split('=');
    return [k, v ?? ''];
  })
);

const config: BenchmarkConfig = {
  iterations: Number(args.get('--iterations') ?? '10000'),
  derivedWidth: Number(args.get('--derived-width') ?? '400'),
};

const results = runBenchmarks(config);

console.log('scope-flux benchmark');
console.log(`iterations=${config.iterations} derivedWidth=${config.derivedWidth}`);
for (const r of results) {
  console.log(
    `${r.name.padEnd(28)} elapsed=${r.elapsedMs.toFixed(2)}ms ops/sec=${r.opsPerSec.toFixed(0)}`
  );
}
