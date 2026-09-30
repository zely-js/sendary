# Staga

SSG Framework for React

## Features

- **File-based Routing**: Generates routes based on file names.

- **Fast startup**: Runs with the speed of Vite and Esbuild.

- **Vite-based**: Leverages Vite's broad ecosystem within staga.

- **`.tsx`, `.jsx` support**: Build type-safe apps with TypeScript.

## Getting Started

- **Download Template**

You can download the current application template from [this repository](https://github.com/do4ng/staga-template).

```bash
git clone https://github.com/do4ng/staga-template my-app
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

## Islands

`Island` keeps a server-rendered subtree as static HTML until it needs to
become interactive. Import it from `staga/components` and choose when to
hydrate it:

```tsx
import { Island } from 'staga/components';
import Comments from './Comments';

export default function PostPage() {
  return (
    <article>
      <h1>Static article content</h1>
      <Island hydrate="visible">
        <Comments />
      </Island>
    </article>
  );
}
```

- `hydrate="visible"` (default): hydrate when the island is near the viewport.
- `hydrate="idle"`: hydrate when the browser is idle.
- `hydrate="load"`: hydrate immediately after the application root.

An island must render the same output on the server and client. It emits one
unstyled `div` boundary so Staga can preserve and hydrate that subtree.

## LICENSE

MIT
