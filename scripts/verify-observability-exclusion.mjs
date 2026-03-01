import { readFile } from 'node:fs/promises';

const targets = [
  'packages/core/dist/src/index.js',
  'packages/react/dist/src/index.js',
  'packages/scheduler/dist/src/index.js',
  'packages/serializer/dist/src/index.js',
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
