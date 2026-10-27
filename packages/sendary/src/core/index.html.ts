import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let cache: { cwd: string; html: string } | null = null;

export function getIndexHtml(): string {
  const cwd = process.cwd();

  if (cache?.cwd === cwd) return cache.html;

  const path = join(cwd, 'index.html');
  const html = existsSync(path)
    ? readFileSync(path, 'utf-8')
    : `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    %head%
  </head>
  <body>
    %body%
  </body>
</html>`;

  cache = { cwd, html };

  return html;
}
