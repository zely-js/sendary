import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import oxc from 'oxc-parser';

import { error, warn } from '~/logger';
import { PAGE_STATIC_DATA_FUNCTION, PAGE_STATIC_PARAMS_FUNCTION } from './constants';
import { changeExtension } from '~/utils/path';

export async function getExports(code: string, filename: string = '@virtual.ts') {
  const result = await oxc.parseAsync(filename, code, {
    lang: 'tsx',
    sourceType: 'module',
  });

  if (result.errors && process.argv.includes('--show-parser-error')) {
    for (const parserError of result.errors) {
      error(
        `[staga/compiler:oxc-parser] ${parserError.message}\n - ${JSON.stringify(parserError).red}`,
      );
    }
  }

  const exports: string[] = [];

  for (const exportEntry of result.module.staticExports) {
    for (const entry of Object.values(exportEntry.entries)) {
      const exportName = entry.exportName;

      if (exportName?.name) {
        exports.push(exportName.name);
      } else if (exportName) {
        exports.push('__default');
      } else {
        warn(`Cannot resolve export name - ${code.slice(entry.start, entry.end)}`);
      }
    }
  }

  return exports;
}

export async function generateOriginalServerFile(
  filename: string,
  hasFunction: { data: boolean; params: boolean; default: boolean },
  cwd: string = process.cwd(),
) {
  if (!isAbsolute(filename)) filename = join(cwd, filename);

  const basePageDirectory = join(cwd, 'pages');
  const relativeFilename = relative(basePageDirectory, filename);
  const outdirectory = join(cwd, '.staga');

  const funcList: string[] = [];

  if (hasFunction.params) funcList.push(PAGE_STATIC_PARAMS_FUNCTION);
  if (hasFunction.data) funcList.push(PAGE_STATIC_DATA_FUNCTION);

  const outServerFile = join(
    outdirectory,
    'intermediate',
    'server',
    changeExtension(relativeFilename, '.ts'),
  );
  const outClientFile = join(
    outdirectory,
    'intermediate',
    'client',
    changeExtension(relativeFilename, '.tsx'),
  );

  await mkdir(dirname(outServerFile), { recursive: true });
  await mkdir(dirname(outClientFile), { recursive: true });

  const serverImport = relative(dirname(outServerFile), filename).replace(/\\/g, '/');
  const clientImport = relative(dirname(outClientFile), filename).replace(/\\/g, '/');

  await writeFile(
    outServerFile,
    `export { ${funcList.join(', ')} } from "${serverImport}";`,
  );

  await writeFile(
    outClientFile,
    hasFunction.default
      ? `export { default as _page } from "${clientImport}";export const __staga_page=true;`
      : 'export const _page = () => null;export const __staga_page=true;',
  );

  return {
    outServerFile,
    outClientFile,
  };
}
