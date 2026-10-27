import { describe, it, expect, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import React from 'react';
import { Manifest } from 'vite';

import { collectCssFiles, parsePathname, serverRendering } from '~/vite/builder/ssr';
import { Island } from '~/components/Island';
import { DefaultError } from '~/client/components/_error';
import { createBuildSummary } from '~/vite/build';

// React dummy component for page
function DummyPage({ props }: { props?: any }) {
  return React.createElement(
    Island,
    null,
    React.createElement('div', null, `Hello ${props?.msg || 'World'}`),
  );
}

describe('serverRendering', () => {
  it('should inject css, preload, and scripts into head', () => {
    const template = `<!DOCTYPE html><html><head><title>Test</title><script type="module" src="/assets/client.js"></script></head><body><div id="_app"></div></body></html>`;

    const html = serverRendering(DummyPage, {
      Layout: ({ children }: any) =>
        React.createElement('div', { id: 'layout' }, children),
      props: { props: { msg: 'SSR' } },
      template,
      cssFiles: ['style.css'],
      staticManifest: { '_index.json': 'initial-page-data' },
      path: '/index',
      scripts: ['client.js'],
    });

    expect(html).toContain('<link rel="stylesheet" href="/style.css" />');
    expect(html).toContain('<link rel="modulepreload" href="/client.js">');
    expect(html).toContain(
      '<link rel="preload" href="/data/initial-page-data.json" as="fetch"></link>',
    );
  });

  it('does not log while rendering the generated 404 document', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    serverRendering(DefaultError, {
      Layout: ({ children }: any) => children,
      props: {},
      template: '<html><head></head><body><div id="_app"></div></body></html>',
      cssFiles: [],
      staticManifest: {},
      path: '/404',
      scripts: [],
    });

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('collectCssFiles', () => {
  it('should collect css dependencies recursively', () => {
    const manifest: Manifest = {
      'entry.js': {
        file: 'entry.js',
        css: ['entry.css'],
        imports: ['dep.js'],
      },
      'dep.js': {
        file: 'dep.js',
        css: ['dep.css'],
      },
    } as any;

    const css = collectCssFiles(manifest, 'entry.js');
    expect(css).toContain('entry.css');
    expect(css).toContain('dep.css');
  });
});

describe('parse pathname', () => {
  it('should parse pathname return consistent url', () => {
    expect(parsePathname('/a')).toBe('/a');
    expect(parsePathname('/a/')).toBe('/a');
  });
});

describe('createBuildSummary', () => {
  it('reports output categories and route data sizes', async () => {
    const outdir = await mkdtemp(join(tmpdir(), 'staga-summary-'));

    try {
      await mkdir(join(outdir, 'data'));
      await mkdir(join(outdir, 'assets'));
      await writeFile(join(outdir, 'index.html'), '<html></html>');
      await writeFile(join(outdir, 'assets', 'app.js'), 'console.log(1)');
      await writeFile(join(outdir, 'assets', 'app.css'), 'body {}');
      await writeFile(join(outdir, 'data', 'home.json'), '{"title":"Home"}');

      const summary = createBuildSummary(outdir, {
        '_.json': 'home',
        '[layout].json': null,
      });

      expect(summary).toContain('HTML');
      expect(summary).toContain('JavaScript');
      expect(summary).toContain('CSS');
      expect(summary).toContain('Static data (1 routes)');
      expect(summary).toContain('/');
      expect(summary).toContain('16 B');
    } finally {
      await rm(outdir, { recursive: true, force: true });
    }
  });
});
