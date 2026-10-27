# Staga App

A static site built with [Staga](https://staga.vercel.app) and React.

## Development

```bash
yarn dev
```

## Build

```bash
yarn build
```

The generated site is written to `dist/`.

## Project structure

- `pages/` contains routes. `pages/index.tsx` is `/`, and `pages/post/[id].tsx` is a
  dynamic route.
- `pages/_layout.tsx` wraps every page.
- `vite.config.ts` registers the React and Staga plugins.

Pages can export `getStaticProps` and `getStaticParams` to generate data for a route.
