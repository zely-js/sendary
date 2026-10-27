# Sendary

SSG Framework for React

## Features

- **👾 File-based Routing**: Generates routes based on file names.
- **⚡ Fast startup**: Runs with the speed of Vite and Esbuild.
- **✨ Vite-based**: Leverages Vite's broad ecosystem within sendary.
- **✔️ `.tsx`, `.jsx` support**: Build type-safe apps with TypeScript.

## Getting Started

- **Download Template**

You can download the current application template via `create-sendary`

```bash
yarn create sendary
```

- **Start Manually**

sendary is provided as a Vite plugin.
Install the sendary core package and the Vite React plugin to apply sendary to an existing project.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { sendary } from 'sendary';

export default defineConfig({
  plugins: [react(), sendary()],
});
```

## Examples

I've implemented sendary in some of my personal projects.

- [Development Docs](https://zely.vercel.app) ([Code](https://github.com/do4ng/website))
- [Blog](https://do4ng.vercel.app) ([Code](https://github.com/do4ng/do4ng.github.io))

## LICENSE

MIT
