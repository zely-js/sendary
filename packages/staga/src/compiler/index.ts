import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { build } from 'esbuild';

import { CompileOptions } from '~/config/types';

import { PAGE_STATIC_DATA_FUNCTION, PAGE_STATIC_PARAMS_FUNCTION } from './constants';
import { generateOriginalServerFile, getExports } from './utils';
import { assetPlugin, sideEffectPlugin, vmPlugin } from './plugin';
import { changeExtension, normalizePath } from '~/utils/path';

export type CompiledPage = {
  client: string;
  server: string;
  dependencies?: string[];
};

type PreparedPage = {
  filename: string;
  clientEntry: string;
  serverEntry: string;
  outfiles: CompiledPage;
};

export type CompileTarget = 'all' | 'client' | 'server';

async function preparePage(
  filename: string,
  options: CompileOptions,
): Promise<PreparedPage> {
  const cwd = process.cwd();
  const source = await readFile(filename, 'utf-8');
  const exports = await getExports(source, filename);

  const intermediateFiles = await generateOriginalServerFile(filename, {
    data: exports.includes(PAGE_STATIC_DATA_FUNCTION),
    params: exports.includes(PAGE_STATIC_PARAMS_FUNCTION),
    default: exports.includes('__default'),
  });

  const relativeFilename = relative(join(cwd, 'pages'), filename);
  const outdirectory = options.outdir ?? join(cwd, '.staga');

  return {
    filename,
    clientEntry: intermediateFiles.outClientFile,
    serverEntry: intermediateFiles.outServerFile,
    outfiles: {
      client: join(outdirectory, 'client', changeExtension(relativeFilename, '.js')),
      server: join(outdirectory, 'server', changeExtension(relativeFilename, '.mjs')),
    },
  };
}

/**
 * Compiles a batch of pages into browser and server modules.
 * https://staga.vercel.app/docs/static-props
 */
export async function compilePageBatch(
  filenames: string[],
  options: CompileOptions = {},
  ignoreAssets: boolean = false,
  target: CompileTarget = 'all',
): Promise<Record<string, CompiledPage>> {
  const pages = await Promise.all(
    filenames.map((filename) => preparePage(filename, options)),
  );
  const outdirectory = options.outdir ?? join(process.cwd(), '.staga');

  if (pages.length === 0) return {};

  const cwd = process.cwd();

  const results = await Promise.all([
    target !== 'server'
      ? build({
          entryPoints: Object.fromEntries(
            pages.map((page) => [
              relative(outdirectory, changeExtension(page.outfiles.client, '')).replace(
                /\\/g,
                '/',
              ),
              page.clientEntry,
            ]),
          ),
          outdir: outdirectory,
          packages: 'external',
          sourcemap: 'inline',
          format: 'esm',
          platform: 'browser',
          treeShaking: true,
          bundle: true,
          jsx: 'automatic',
          ignoreAnnotations: true,
          metafile: true,
          plugins: [
            sideEffectPlugin(options),
            assetPlugin(undefined, ignoreAssets, options),
          ],
        })
      : null,
    target !== 'client'
      ? build({
          entryPoints: Object.fromEntries(
            pages.map((page) => [
              relative(outdirectory, changeExtension(page.outfiles.server, '')).replace(
                /\\/g,
                '/',
              ),
              page.serverEntry,
            ]),
          ),
          outdir: outdirectory,
          outExtension: { '.js': '.mjs' },
          packages: 'external',
          format: 'esm',
          platform: 'node',
          treeShaking: true,
          bundle: true,
          ignoreAnnotations: true,
          metafile: true,
          plugins: [
            sideEffectPlugin(options),
            assetPlugin(undefined, true, options),
            vmPlugin(),
          ],
        })
      : null,
  ]);

  const clientResult = results[0];
  const serverResult = results[1];

  const clientOutputs = clientResult?.metafile?.outputs ?? {};
  const serverOutputs = serverResult?.metafile?.outputs ?? {};

  for (const page of pages) {
    const dependencies = new Set<string>();

    const targetClient = normalizePath(page.outfiles.client);
    for (const [outKey, outMeta] of Object.entries(clientOutputs)) {
      if (normalizePath(resolve(cwd, outKey)) === targetClient) {
        for (const inKey of Object.keys(outMeta.inputs)) {
          const resolved = resolve(cwd, inKey);
          if (!resolved.includes('.staga')) {
            dependencies.add(resolved);
          }
        }
      }
    }

    const targetServer = normalizePath(page.outfiles.server);
    for (const [outKey, outMeta] of Object.entries(serverOutputs)) {
      if (normalizePath(resolve(cwd, outKey)) === targetServer) {
        for (const inKey of Object.keys(outMeta.inputs)) {
          const resolved = resolve(cwd, inKey);
          if (!resolved.includes('.staga')) {
            dependencies.add(resolved);
          }
        }
      }
    }

    dependencies.add(resolve(page.filename));
    page.outfiles.dependencies = Array.from(dependencies);
  }

  return Object.fromEntries(pages.map((page) => [page.filename, page.outfiles]));
}

export async function compilePage(
  filename: string,
  options: CompileOptions = {},
  ignoreAssets: boolean,
) {
  const pages = await compilePageBatch([filename], options, ignoreAssets);
  return { outfiles: pages[filename] };
}
