import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { staga } from '../index';

describe('staga dev HMR', () => {
  const initialCwd = process.cwd();
  let directory: string;

  afterEach(async () => {
    process.chdir(initialCwd);
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('triggers HMR update for pages importing a changed component', async () => {
    directory = await mkdtemp(join(tmpdir(), 'staga-hmr-'));
    const pagesDirectory = join(directory, 'pages');
    const componentsDirectory = join(directory, 'components');
    const outdir = join(directory, '.staga');

    await mkdir(pagesDirectory, { recursive: true });
    await mkdir(componentsDirectory, { recursive: true });

    const buttonFile = join(componentsDirectory, 'Button.tsx');
    const indexFile = join(pagesDirectory, 'index.tsx');

    await writeFile(buttonFile, 'export const Button = () => <div>Button V1</div>;');
    await writeFile(
      indexFile,
      "import { Button } from '../components/Button'; export default () => <Button />;",
    );

    process.chdir(directory);

    const [stagaPlugin] = staga({ compileOptions: { outdir } });

    const wsSend = vi.fn();
    const invalidateModule = vi.fn();

    const compiledIndexJs = join(outdir, 'client', 'index.js').replace(/\\/g, '/');

    const mockModule = {
      id: compiledIndexJs,
      file: compiledIndexJs,
      url: '/.staga/client/index.js',
    };

    const server: any = {
      ws: { send: wsSend },
      moduleGraph: {
        getModuleById: vi.fn((id) => (id === mockModule.id ? mockModule : null)),
        getModuleByUrl: vi.fn(async () => null),
        getModulesByFile: vi.fn((file) =>
          file.replace(/\\/g, '/') === compiledIndexJs ? new Set([mockModule]) : null,
        ),
        invalidateModule,
        urlToModuleMap: new Map([[mockModule.url, mockModule]]),
        idToModuleMap: new Map([[mockModule.id, mockModule]]),
      },
    };

    const plugin = stagaPlugin as any;
    if (plugin.configResolved) {
      plugin.configResolved({ logger: { info: vi.fn() } });
    }
    if (plugin.buildStart) {
      await plugin.buildStart();
    }
    if (plugin.load) {
      await plugin.load('\0$staga-manifest');
    }

    // Update the dependency file (components/Button.tsx)
    await writeFile(buttonFile, 'export const Button = () => <div>Button V2</div>;');

    const result = await (stagaPlugin.handleHotUpdate as any).call({} as any, {
      server,
      file: buttonFile,
    });

    expect(result).toEqual([]);
    expect(invalidateModule).toHaveBeenCalledWith(mockModule);
    expect(wsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        updates: expect.arrayContaining([
          expect.objectContaining({
            type: 'js-update',
            path: mockModule.url,
            acceptedPath: mockModule.url,
          }),
        ]),
      }),
    );
  });

  it('triggers HMR update when a main page file is modified', async () => {
    directory = await mkdtemp(join(tmpdir(), 'staga-hmr-page-'));
    const pagesDirectory = join(directory, 'pages');
    const outdir = join(directory, '.staga');

    await mkdir(pagesDirectory, { recursive: true });

    const indexFile = join(pagesDirectory, 'index.tsx');
    await writeFile(indexFile, 'export default () => <div>Page V1</div>;');

    process.chdir(directory);

    const [stagaPlugin] = staga({ compileOptions: { outdir } });

    const wsSend = vi.fn();
    const invalidateModule = vi.fn();

    const compiledIndexJs = join(outdir, 'client', 'index.js').replace(/\\/g, '/');

    const mockModule = {
      id: compiledIndexJs,
      file: compiledIndexJs,
      url: '/.staga/client/index.js',
    };

    const server: any = {
      ws: { send: wsSend },
      moduleGraph: {
        getModuleById: vi.fn((id) => (id === mockModule.id ? mockModule : null)),
        getModuleByUrl: vi.fn(async () => null),
        getModulesByFile: vi.fn((file) =>
          file.replace(/\\/g, '/') === compiledIndexJs ? new Set([mockModule]) : null,
        ),
        invalidateModule,
        urlToModuleMap: new Map([[mockModule.url, mockModule]]),
        idToModuleMap: new Map([[mockModule.id, mockModule]]),
      },
    };

    const plugin = stagaPlugin as any;
    if (plugin.configResolved) {
      plugin.configResolved({ logger: { info: vi.fn() } });
    }
    if (plugin.buildStart) {
      await plugin.buildStart();
    }
    if (plugin.load) {
      await plugin.load('\0$staga-manifest');
    }

    await writeFile(indexFile, 'export default () => <div>Page V2</div>;');

    const result = await (stagaPlugin.handleHotUpdate as any).call({} as any, {
      server,
      file: indexFile,
    });

    expect(result).toEqual([]);
    expect(invalidateModule).toHaveBeenCalledWith(mockModule);
  });

  it('does not trigger HMR update for pages when an unrelated file is modified', async () => {
    directory = await mkdtemp(join(tmpdir(), 'staga-hmr-unrelated-'));
    const pagesDirectory = join(directory, 'pages');
    const componentsDirectory = join(directory, 'components');
    const outdir = join(directory, '.staga');

    await mkdir(pagesDirectory, { recursive: true });
    await mkdir(componentsDirectory, { recursive: true });

    const unrelatedFile = join(componentsDirectory, 'Unrelated.tsx');
    const indexFile = join(pagesDirectory, 'index.tsx');

    await writeFile(
      unrelatedFile,
      'export const Unrelated = () => <div>Unrelated</div>;',
    );
    await writeFile(indexFile, 'export default () => <div>Page</div>;');

    process.chdir(directory);

    const [stagaPlugin] = staga({ compileOptions: { outdir } });

    const wsSend = vi.fn();
    const invalidateModule = vi.fn();

    const compiledIndexJs = join(outdir, 'client', 'index.js').replace(/\\/g, '/');

    const mockModule = {
      id: compiledIndexJs,
      file: compiledIndexJs,
      url: '/.staga/client/index.js',
    };

    const server: any = {
      ws: { send: wsSend },
      moduleGraph: {
        getModuleById: vi.fn((id) => (id === mockModule.id ? mockModule : null)),
        getModuleByUrl: vi.fn(async () => null),
        getModulesByFile: vi.fn((file) =>
          file.replace(/\\/g, '/') === compiledIndexJs ? new Set([mockModule]) : null,
        ),
        invalidateModule,
        urlToModuleMap: new Map([[mockModule.url, mockModule]]),
        idToModuleMap: new Map([[mockModule.id, mockModule]]),
      },
    };

    const plugin = stagaPlugin as any;
    if (plugin.configResolved) {
      plugin.configResolved({ logger: { info: vi.fn() } });
    }
    if (plugin.buildStart) {
      await plugin.buildStart();
    }
    if (plugin.load) {
      await plugin.load('\0$staga-manifest');
    }

    // Modify unrelated file
    await writeFile(unrelatedFile, 'export const Unrelated = () => <div>Changed</div>;');

    const result = await (stagaPlugin.handleHotUpdate as any).call({} as any, {
      server,
      file: unrelatedFile,
    });

    // Should return undefined to let Vite handle it or no affected pages
    expect(result).toBeUndefined();
    expect(invalidateModule).not.toHaveBeenCalledWith(mockModule);
  });
});
