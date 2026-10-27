# Staga

SSG Framework for React

## Features

- **👾 File-based Routing**: Generates routes based on file names.
- **⚡ Fast startup**: Runs with the speed of Vite and Esbuild.
- **✨ Vite-based**: Leverages Vite's broad ecosystem within staga.
- **✔️ `.tsx`, `.jsx` support**: Build type-safe apps with TypeScript.

## Getting Started

- **Download Template**

You can download the current application template via `create-staga`

```bash
yarn create staga
```

- **Start Manually**

staga is provided as a Vite plugin.
Install the staga core package and the Vite React plugin to apply staga to an existing project.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { staga } from 'staga';

export default defineConfig({
  plugins: [react(), staga()],
});
```

## LICENSE

MIT
