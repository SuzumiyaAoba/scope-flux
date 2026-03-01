import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const fromApi = resolve(root, 'docs/api');
const toTypedoc = resolve(root, 'website/public/typedoc');

await rm(toTypedoc, { recursive: true, force: true });
await mkdir(resolve(root, 'website/public'), { recursive: true });
await cp(fromApi, toTypedoc, { recursive: true });

console.log('docs assets synced');
