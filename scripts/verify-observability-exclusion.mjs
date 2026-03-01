import { readFile } from 'node:fs/promises';

const targets = [
  'packages/core/dist/index.js',
  'packages/react/dist/index.js',
  'packages/scheduler/dist/index.js',
  'packages/serializer/dist/index.js',
];

const forbidden = ['@scope-flux/inspect', 'packages/inspect'];

for (const file of targets) {
  const text = await readFile(file, 'utf8');
  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`Observability code leaked into runtime package: ${file} contains ${token}`);
    }
  }
}

console.log('verify:observability passed');
