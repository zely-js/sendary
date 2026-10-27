import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getIndexHtml } from './index.html';

export type CompiledPages = Record<string, { client: string; server: string }>;

export function getPagesModule(dist: string, pages: CompiledPages): string {
  const entries = Object.keys(pages).map((page) => {
    const target = relative(dist, pages[page].client).replace(/\\/g, '/');
    return `  ${JSON.stringify(page)}: () => import(${JSON.stringify(`./${target}`)}),\n`;
  });

  return `export default {${entries.join('\n')}}`;
}

export function writePagesModule(dist: string, pages: CompiledPages) {
  writeFileSync(join(dist, 'manifest.js'), getPagesModule(dist, pages));
}

export function initialize(
  dist: string = join(process.cwd(), '.staga'),
  pages: CompiledPages,
) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    getIndexHtml()
      .replace('%body%', '<div id="_app"></div>')
      .replace('%head%', '<script src="/.staga/client.js" type="module"></script>'),
  );
  writeFileSync(join(dist, 'client.js'), 'import "$staga-client";');
  writePagesModule(dist, pages);
}
