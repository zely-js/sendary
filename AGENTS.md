# AGENTS.md

Staga is a Vite-plugin SSG framework for React, developed as a Yarn 1 workspaces repo.
There is no runnable app or dev server at the repo root; the framework is consumed by
external Vite apps.

## Layout

- `packages/staga` — published core: Vite plugin, esbuild page compiler, client runtime,
  and the `staga/components` / `staga/client` entrypoints.
- `packages/create-staga` — scaffold CLI plus a partial starter in `template/` (not a
  workspace app).
- `packages/tsconfig/tsconfig.base.json` — shared TS config; defines `~/*` →
  `packages/staga/src/*`.
- No CI workflows exist; verification is local.

## Commands (from repo root)

- `yarn test --run` — one-shot tests. Plain `yarn test` starts Vitest in **watch mode**.
- `yarn vitest run <test-file> [-t "name"]` — single test file or case.
- `yarn tsc --noEmit -p packages/staga/tsconfig.json` — typecheck per package.
  Do **not** use root `tsconfig.json`: it does not resolve `~/*` and reports false errors
  (and duplicate Vite types from `vitest.config.ts`).
- `yarn lint-fix` — mutating ESLint/Prettier pass. There is no check-only lint script;
  use `yarn eslint <paths>` to check.
- `yarn build` — runs `scripts/build.ts` via serpack, builds every entry listed in
  `packages/*/build.json` with esbuild, then emits `.d.ts` via Rollup. It deletes and
  recreates `packages/*/dist` first.
- Set `BUILD_SUMMARY=true` when running `vite build` in a consumer app to print Staga's
  HTML/JS/CSS/data size summary.

## Architecture

- `staga()` in `src/vite/index.ts` returns two Vite plugins: the dev/HMR plugin and
  `staga:build` (`src/vite/build.ts`). Pages are always read from `<cwd>/pages` and written
  to `.staga/` in dev or `build.outDir` in production.
- Page contract: a default export renders the page; named `getStaticProps(ctx)` and
  `getStaticParams()` are discovered by parsing source with `oxc-parser`. `_layout.tsx`
  maps to `[layout]` and `_error.tsx` to `[error]` (`src/core/routing.ts`). A dynamic page
  normally needs `getStaticParams`; without it, the non-params branch writes a route
  containing the literal `[param]` placeholder.
- Each page is built twice by esbuild (`src/compiler/index.ts`): a browser ESM client
  module exporting `_page`, and a Node ESM server module exporting the static functions.
  Intermediates land in `.staga/intermediate`.
- `$staga-manifest`, `$staga-client`, `$staga-router`, and `$staga-pages` are Vite virtual
  modules resolved in `src/vite/index.ts`; `$staga-pages` points at the generated
  `manifest.js`. Update `env.d.ts` when changing their contracts.
- The server implementation of `$staga-router` is the string in
  `src/compiler/server-router.ts`. Keep it as source text: the compiler ships as one
  bundled file and cannot resolve a sibling module at runtime.
- Build flow: static props → `data/*.json`, SSR → HTML, then `.staga` intermediates are
  deleted. Production hydration lives in `src/client/client.ts` and `src/client/router.ts`.

## Invariants and gotchas

- Static pages must stay JS-free. `serverRendering` injects client scripts/manifest only
  when the rendered HTML contains `data-staga-island`, and strips the `data-staga-client`
  script otherwise. Tests assert this; preserve the behavior.
- `<Island>` is the only hydration boundary: it renders children with
  `renderToStaticMarkup` on the server, then hydrates a separate root in the browser.
- `process.cwd()` drives page discovery and output everywhere. Tests create temp dirs,
  `process.chdir()` into them, and must restore the original cwd in `afterEach`.
- Root Vitest uses `projects: ['packages/*/vitest.config.ts']` with `isolate: false` and
  `globals: true`. A new package needs its own `vitest.config.ts` to be picked up.
- Adding a public entrypoint requires updating `packages/<pkg>/build.json` (drives both
  esbuild and Rollup) plus the package's `exports`/`types`.
- The default layout file is literally `src/client/components/_layout..ts` (double dot);
  `_error.ts` is the default error component. Consumer `pages/_layout.tsx` and
  `pages/_error.tsx` override them.
- Build prints `import.meta` CJS warnings for the client/router entries; they are
  expected and do not fail the build.
- ESLint is Prettier-integrated (formatting issues fail lint) and enforces `node:`
  protocol imports. `@typescript-eslint/no-explicit-any` is disabled.
