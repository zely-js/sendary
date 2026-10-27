import { join, parse, relative } from 'node:path';
import { CompileTarget, compilePageBatch } from '~/compiler';
import { CompileOptions } from '~/config/types';
import { scanDirectory } from '~/utils/fs';
import { prettyURL } from '~/utils/url';

/**
 * Compiles every page under `<cwd>/pages` and maps each route to its client and server modules.
 * https://sendary.vercel.app/docs/routing
 */
export async function compilePages(
  compileOptions?: CompileOptions,
  ignoreAssets: boolean = false,
  target: CompileTarget = 'all',
): Promise<Record<string, { server: string; client: string; dependencies?: string[] }>> {
  const baseDir = join(process.cwd(), 'pages');
  const pages = scanDirectory(baseDir);
  const output: Record<
    string,
    { server: string; client: string; dependencies?: string[] }
  > = {};

  const compiledPages = await compilePageBatch(
    pages,
    compileOptions,
    ignoreAssets,
    target,
  );

  for (const page of pages) {
    const pageName = parse(page).name;
    let name = prettyURL(relative(baseDir, page).replace(/\\/g, '/'));

    if (pageName === '_layout') {
      name = '[layout]';
    } else if (pageName === '_error') {
      name = '[error]';
    }

    output[name] = compiledPages[page];
  }

  return output;
}
