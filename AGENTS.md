# Repository Guidelines

## Project Structure & Module Organization
This repository is a TypeScript monorepo using npm workspaces.
- `packages/*/src`: package source code (`core`, `scheduler`, `serializer`, `inspect`, `react`, `benchmark`).
- `packages/*/test`: unit/integration tests (`*.test.ts` / `*.test.tsx`).
- `samples/`: runnable usage examples (`pure.ts`, `react.tsx`).
- `docs-site/` and `website/`: documentation site source and content.
- `scripts/`: maintenance scripts (ID checks, docs sync, observability verification).
- Generated outputs: `packages/*/dist`, `coverage/`, `docs/api`, `website/public/typedoc`.

## Build, Test, and Development Commands
Use root `package.json` scripts:
- `npm run build`: clean and build all packages via `tsup`.
- `npm run typecheck`: strict TS type check (`tsconfig.typecheck.json`, no emit).
- `npm test`: run all tests with Vitest.
- `npm run test:coverage`: run tests with coverage report and thresholds.
- `npm run docs:dev`: start docs site at port 3000.
- `npm run samples:all`: build packages and execute all samples.
- `npm run verify:observability`: run observability exclusion verification.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true`, ESM via `module: NodeNext`).
- Indentation: 2 spaces; keep imports explicit and type-safe.
- File naming: package entrypoints use `src/index.ts` or `src/index.tsx`.
- Test files: `packages/<name>/test/<feature>.test.ts(x)`.
- Prefer stable IDs/debug names for runtime units (e.g., `cell(..., { id: 'count' })`).

## Testing Guidelines
- Framework: Vitest (`vite.config.ts`, environment `node`).
- Coverage thresholds: lines 85, statements 85, functions 90, branches 80.
- Coverage includes `packages/*/src/**/*.{ts,tsx}` (excluding `*.d.ts`, `run.ts`).
- Add tests for new behavior and regressions in the corresponding package test folder.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat(...)`, `fix(...)`, `docs(...)`, `test(...)`, `build(...)`, `chore(...)`.
  Example: `feat(react): add useCell hook`.
- Keep commits focused by package or concern.
- PRs should include: purpose, affected packages, test command results, and linked issues.
- If behavior/API/docs-site output changes, update docs and include screenshots or preview notes where relevant.
