# Samples

This directory contains runnable TypeScript examples for `scope-flux`.

## Prerequisites

Build package outputs first:

```bash
npm run build:packages
```

## Build samples

```bash
npm run samples:build
```

## Run pure sample

```bash
npm run samples:pure
```

## Run React sample

```bash
npm run samples:react
```

## Run all

```bash
npm run samples:all
```

## What each sample shows

- `pure.ts`: framework-agnostic usage (`core`, `scheduler`, `serializer`, `inspect`).
- `react.tsx`: React integration with `StoreProvider`, `useCell`, `useUnit`, and `useAction`.
