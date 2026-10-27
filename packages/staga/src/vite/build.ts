import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, parse, relative } from 'node:path';

import { createServer, Manifest, Plugin, ResolvedConfig, ViteDevServer } from 'vite';

import { initialize } from '~/core';
import { compilePages } from '~/core/routing';
import { CompileOptions } from '~/config/types';
import { scanDirectory } from '~/utils/fs';

import { createStaticHTML } from './builder/ssr';
import { createStaticProps } from './builder/props';

function getFilesizeInBytes(filename: string) {
  return existsSync(filename) ? statSync(filename).size : undefined;
}

function formatFilesize(bytes: number) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unit;

  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function getStaticRoute(staticFile: string) {
  const route = staticFile.slice(0, -extname(staticFile).length).replace(/_/g, '/');
  return route === '/' ? '/' : route || '/';
}

export function createBuildSummary(
  outDir: string,
  staticManifest: Record<string, string | null>,
) {
  const sizes = { html: 0, javascript: 0, css: 0, data: 0, other: 0 };
  let files = 0;

  for (const file of scanDirectory(outDir)) {
    const size = getFilesizeInBytes(file) ?? 0;
    const extension = extname(file).toLowerCase();
    files += 1;

    if (extension === '.html') sizes.html += size;
    else if (extension === '.js' || extension === '.mjs') sizes.javascript += size;
    else if (extension === '.css') sizes.css += size;
    else if (file.startsWith(join(outDir, 'data'))) sizes.data += size;
    else sizes.other += size;
  }

  const total = Object.values(sizes).reduce((sum, size) => sum + size, 0);
  const rows = Object.keys(staticManifest)
    .filter((staticFile) => !staticFile.startsWith('[layout]'))
    .filter((staticFile) => !staticFile.startsWith('[error]'))
    .sort()
    .map((staticFile) => {
      const id = staticManifest[staticFile];
      const dataFile = id ? join(outDir, 'data', `${id}.json`) : null;
      const dataSize = dataFile ? (getFilesizeInBytes(dataFile) ?? 0) : 0;
      const label = id ? formatFilesize(dataSize) : '—';

      return `  ${getStaticRoute(staticFile).padEnd(46)}${label}`;
    });

  return [
    'Staga Build Summary',
    `${files} files · ${formatFilesize(total)}`,
    '',
    `  HTML       ${formatFilesize(sizes.html)}`,
    `  JavaScript ${formatFilesize(sizes.javascript)}`,
    `  CSS        ${formatFilesize(sizes.css)}`,
    `  Data       ${formatFilesize(sizes.data)}`,
    `  Other      ${formatFilesize(sizes.other)}`,
    '',
    `Static data (${rows.length} routes)`,
    ...(rows.length ? rows : ['  No static data']),
  ].join('\n');
}

export function stagaBuild(compilerOptions: CompileOptions = {}): Plugin {
  let viteConfig: ResolvedConfig;

  const pageMap: Record<string, string> = {};

  let pages: Awaited<ReturnType<typeof compilePages>>;
  let vite: ViteDevServer;
  let staticManifest: Record<string, string | null>;

  function generatePageMap(
    bundle: import('rollup').OutputBundle,
  ): Record<string, string> {
    if (Object.keys(pageMap).length !== 0) return pageMap;

    for (const key in bundle) {
      if (bundle[key].type === 'asset') continue;
      if (!bundle[key].isDynamicEntry && !bundle[key].exports.includes('__staga_page'))
        continue;

      let setKey = relative(
        join('.staga', 'client').replace(/\\/g, '/'),
        bundle[key].facadeModuleId,
      );

      const pageName = parse(setKey).name;

      if (pageName === '_layout') setKey = '[layout]';
      if (pageName === '_error') setKey = '[error]';

      pageMap[setKey] = key;
    }

    return pageMap;
  }

  return {
    name: 'staga:build',
    apply: 'build',

    async config(config) {
      initialize(config.build.outDir || 'dist', {});
      pages = await compilePages({
        ...compilerOptions,
        outdir: config.build.outDir || 'dist',
      });

      config.build ??= {};
      config.build.rollupOptions ??= {};
      config.build.rollupOptions.input ??= {};

      config.build.manifest = true;
      config.build.rollupOptions.input['index.html'] = 'index.html';

      vite = await createServer({
        server: { middlewareMode: true, hmr: false },
        ...config,
      });
    },

    async configResolved(config) {
      viteConfig = config;
    },

    async generateBundle(options, bundle) {
      pages = await compilePages({ ...compilerOptions, outdir: viteConfig.build.outDir });
      initialize(viteConfig.build.outDir, pages);

      staticManifest = await createStaticProps(pages, viteConfig.build.outDir);

      writeFileSync(
        join(viteConfig.build.outDir, 'map.json'),
        JSON.stringify(generatePageMap(bundle)),
      );
    },

    async writeBundle() {
      const { outDir } = viteConfig.build;
      const indexHTML = readFileSync(join(outDir, 'index.html')).toString();

      pages = await compilePages(
        { ...compilerOptions, outdir: viteConfig.build.outDir },
        true,
        'client',
      );

      const manifestPath = join(outDir, '.vite/manifest.json');
      const manifest: Manifest = JSON.parse(readFileSync(manifestPath).toString());

      await createStaticHTML(
        pages,
        viteConfig.build.outDir,
        vite,
        indexHTML,
        manifest,
        staticManifest,
      );

      await vite.close();

      rmSync(join(outDir, 'map.json'), { recursive: true, force: true });
      rmSync(join(outDir, 'manifest.js'), { recursive: true, force: true });
      rmSync(join(outDir, 'client.js'), { recursive: true, force: true });
      rmSync(join(outDir, 'server'), { recursive: true, force: true });
      rmSync(join(outDir, 'client'), { recursive: true, force: true });

      if (process.env.BUILD_SUMMARY) {
        console.log(createBuildSummary(outDir, staticManifest));
      }
      console.log();
    },

    transformIndexHtml(html) {
      return {
        html: html,
        tags: [
          {
            tag: 'script',
            injectTo: 'head',
            attrs: { id: '__PAGE_MAP__', type: 'text/javascript' },
            children: `window.__STAGA_PAGEMAP__ = ${JSON.stringify(pageMap)}`,
          },
        ],
      };
    },
  };
}
