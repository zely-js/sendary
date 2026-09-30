import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getIndexHtml } from './index.html';

export function initialize(
  dist: string = join(process.cwd(), '.staga'),
  pages: Record<string, { client: string; server: string }>,
) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    getIndexHtml()
      .replace('%body%', '<div id="_app"></div>')
      .replace('%head%', '<script src="/.staga/client.js" type="module"></script>'),
  );
  writeFileSync(join(dist, 'client.js'), 'import "$staga-client";');
  writeFileSync(
    join(dist, 'manifest.js'),
    `export default {${Object.keys(pages)
      .map(
        (page) =>
          `  "${page}": () => import("./${relative(dist, pages[page].client).replace(/\\/g, '/')}"),\n`,
      )
      .join('\n')}}`,
  );
}
