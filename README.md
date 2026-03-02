# scope-flux

TypeScript 向けの状態管理ライブラリ群です。  
このリポジトリは npm workspaces のモノレポ構成になっています。

## Packages

- `@suzumiyaaoba/scope-flux-core`
- `@suzumiyaaoba/scope-flux-react`
- `@suzumiyaaoba/scope-flux-scheduler`
- `@suzumiyaaoba/scope-flux-serializer`
- `@suzumiyaaoba/scope-flux-inspect`

## Development

```bash
npm ci
npm run build
npm run typecheck
npm test
```

## Docs

- 開発時: `npm run docs:dev`
- ビルド: `npm run docs:build`
- API リファレンス生成: `npm run docs:api`

GitHub Pages を有効化している場合は `/scope/` 配下でドキュメントを参照できます。
