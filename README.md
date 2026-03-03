# scope-flux

A set of state management libraries for TypeScript.  
This repository is a monorepo powered by npm workspaces.

## Packages

- `@suzumiyaaoba/scope-flux-core`
- `@suzumiyaaoba/scope-flux-react`
- `@suzumiyaaoba/scope-flux-scheduler`
- `@suzumiyaaoba/scope-flux-serializer`
- `@suzumiyaaoba/scope-flux-inspect`

## Development

```bash
npm ci
npm run lint
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run bench:regression
```

## Quality & Security

- CI validates Node.js 20/22 matrix.
- Security workflow runs `npm audit` and CodeQL.
- Dependabot is enabled for npm and GitHub Actions.

## Docs

- Development: `npm run docs:dev`
- Build: `npm run docs:build`
- Generate API reference: `npm run docs:api`

If GitHub Pages is enabled, you can access the documentation under `/scope/`.
