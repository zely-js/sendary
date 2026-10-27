import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { renderToString } from 'react-dom/server';
import React from 'react';
import { ViteDevServer, Manifest } from 'vite';

import { DefaultError } from '~/client/components/_error';
import { DefaultLayout } from '~/client/components/_layout.';
import { compilePages } from '~/core/routing';
import { changeExtension } from '~/utils/path';
import { Spinner } from '~/utils/spinner';
import { getUniqueArray } from '~/utils/array';
import { resetIslandCounter } from '~/components/Island';
import { SendaryErrorComponent, SendaryLayout, SendaryPage } from '../type';

import { getStaticParams, replaceParamsInRoute } from './shared';

const fileRegexp = /^[^/\\]+[\\/]/;

interface SSRProps {
  Layout: any;
  props: object;
  template: string;
  cssFiles: string[];
  staticManifest: Record<string, string | null>;
  path: string;
  scripts: string[];
}

export function parsePathname(url: string) {
  let { pathname } = new URL(url, 'http://localhost/');

  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  return pathname;
}

function collectChunkFiles(
  manifest: Manifest,
  entry: string,
  select: (chunk: any) => string | string[] | undefined,
  importsFirst = false,
): string[] {
  const result = new Set<string>();
  const visited = new Set<string>();

  function recurse(key: string) {
    if (visited.has(key)) return;
    visited.add(key);

    const chunk = manifest[key];
    if (!chunk) return;

    const add = () => {
      const selected = select(chunk);
      if (!selected) return;
      for (const file of Array.isArray(selected) ? selected : [selected]) {
        result.add(file);
      }
    };

    if (!importsFirst) add();
    for (const imported of chunk.imports ?? []) recurse(imported);
    if (importsFirst) add();
  }

  recurse(entry);
  return [...result];
}

export function collectCssFiles(manifest: Manifest, entry: string): string[] {
  return collectChunkFiles(manifest, entry, (chunk) => chunk.css);
}

export function collectJavaScriptFiles(manifest: Manifest, entry: string): string[] {
  return collectChunkFiles(manifest, entry, (chunk) => chunk.file, true);
}

function readStaticProps(
  outdir: string,
  staticManifest: Record<string, string | null>,
  route: string,
) {
  const key = route.replace(/\//g, '_') + '.json';
  const file = changeExtension(
    join(outdir, 'data', staticManifest[key] || '_empty'),
    '.json',
  );

  return JSON.parse(readFileSync(file, 'utf-8'));
}

function getHtmlOutput(outdir: string, route: string, params: boolean) {
  return params
    ? changeExtension(join(outdir, route), '.html')
    : join(outdir, route, 'index.html');
}

export const serverRendering = (
  children: any,
  { Layout, props, template, cssFiles, staticManifest, path, scripts }: SSRProps,
) => {
  resetIslandCounter();
  global.__SENDARY_SSR_DATA__ = {
    pathname: path,
    params: (props as any).params || {},
    preload: [],
    head: [],
  };

  const component = React.createElement(children, {
    ...props,
    key: path,
  });
  const string = renderToString(React.createElement(Layout, null, component));
  const insert: string[] = [];

  for (const cssChunk of cssFiles) {
    insert.push(`<link rel="stylesheet" href="/${cssChunk}" />`);
  }

  for (const preloadFile of global.__SENDARY_SSR_DATA__.preload) {
    insert.push(`<link rel="prefetch" href="${preloadFile}" />`);
  }

  for (const script of scripts) {
    insert.push(`<link rel="modulepreload" href="/${script}"></link>`);
  }

  insert.push(
    `<script id="__STATIC_MANIFEST__" type="application/json">${JSON.stringify(staticManifest)}</script>`,
  );

  const currentPageData = staticManifest[path.replace(/\//g, '_') + '.json'];
  if (currentPageData) {
    insert.push(
      `<link rel="preload" href="/data/${currentPageData}.json" as="fetch"></link>`,
    );
  }

  for (const head of global.__SENDARY_SSR_DATA__.head) {
    switch (head.type) {
      case 'html':
        insert.push(head.data);
        break;

      case 'preload-data-link': {
        const page = parsePathname(head.data).replace(/\//g, '_') + '.json';
        if (staticManifest[page]) {
          insert.push(
            `<link rel="preload" href="/data/${staticManifest[page]}.json" as="fetch"></link>`,
          );
        } else {
          insert.push(`<!--${head.data}-->`);
        }
        break;
      }

      default:
        break;
    }
  }

  template = template.replace(/<head[^>]*>([\s\S]*?)<\/head>/, (match, inner) => {
    const attributes = match.match(/<head([^>]*)>/)?.[1] || '';
    return `<head${attributes}>${insert.join('')}\n${inner}</head>`;
  });

  return template.replace('<div id="_app"></div>', `<div id="_app">${string}</div>`);
};

/**
 * Renders every compiled page to HTML and writes the static output.
 * https://sendary.vercel.app/docs/build-app
 */
export async function createStaticHTML(
  pages: Awaited<ReturnType<typeof compilePages>>,
  outdir: string,
  vite: ViteDevServer,
  template: string,
  manifest: Manifest,
  staticManifest: Record<string, string | null>,
) {
  const startTime = performance.now();
  const spinner = new Spinner();

  spinner.message = 'Generating html files...';
  spinner.start();

  const getLayout = async (): Promise<SendaryLayout> => {
    if (!pages['[layout]']) return DefaultLayout;
    return (await vite.ssrLoadModule(pages['[layout]'].client))._page;
  };

  const getError = async (): Promise<SendaryErrorComponent> => {
    if (!pages['[error]']) return DefaultError;
    return (await vite.ssrLoadModule(pages['[error]'].client))._page;
  };

  const getClientComponent = async (path: string): Promise<SendaryPage> => {
    return (await vite.ssrLoadModule(path))._page;
  };

  const ErrorComponent = await getError();
  const Layout = await getLayout();

  const layoutCompiledFile = pages['[layout]']
    ? `.sendary/${pages['[layout]'].client.replace(fileRegexp, '')}`.replace(/\\/g, '/')
    : null;
  const layoutCss = layoutCompiledFile
    ? collectCssFiles(manifest, layoutCompiledFile)
    : [];
  const layoutScript = layoutCompiledFile
    ? manifest[layoutCompiledFile]?.file
    : undefined;

  mkdirSync(join(outdir, 'data'), { recursive: true });
  writeFileSync(join(outdir, 'data', '_empty.json'), '{}');

  for (const pageName in pages) {
    const page = pages[pageName];
    const data = await import(pathToFileURL(page.server).href);
    const paramsList = await getStaticParams(
      pageName,
      data,
      'An error occurred while generating HTML file. - Static params function must return array.',
    );

    if (!paramsList && pageName.startsWith('[') && pageName.endsWith(']')) {
      continue;
    }

    const compiledFile = `.sendary/${page.client.replace(fileRegexp, '')}`.replace(
      /\\/g,
      '/',
    );
    const cssFiles = collectCssFiles(manifest, compiledFile);
    const scripts = collectJavaScriptFiles(manifest, compiledFile);
    const Client = await getClientComponent(page.client);

    for (const params of paramsList ?? [null]) {
      const route = replaceParamsInRoute(pageName, params ?? {});
      const outStaticPage = getHtmlOutput(outdir, route, Boolean(paramsList));

      spinner.message = `Generating html files... - ${route}`;

      const ssrProps: SSRProps = {
        Layout,
        props: {
          props: readStaticProps(outdir, staticManifest, route),
          params: params ?? {},
        },
        template,
        cssFiles: getUniqueArray([...cssFiles, ...layoutCss]),
        staticManifest,
        path: route,
        scripts: getUniqueArray([layoutScript, ...scripts].filter(Boolean)),
      };

      mkdirSync(dirname(outStaticPage), { recursive: true });
      writeFileSync(outStaticPage, serverRendering(Client, ssrProps));
    }
  }

  const errorProps: SSRProps = {
    Layout,
    props: {},
    template,
    cssFiles: layoutCss,
    staticManifest,
    path: '.sendary/ssr:unknown',
    scripts: [],
  };

  writeFileSync(join(outdir, '404.html'), serverRendering(ErrorComponent, errorProps));

  spinner.stop(
    `html files generated. (${((performance.now() - startTime) / 1000).toFixed(2)}s)`,
  );
}
