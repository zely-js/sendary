import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { compilePageBatch } from '..';

describe('compilePageBatch', () => {
  const initialCwd = process.cwd();
  let directory: string;

  afterEach(async () => {
    process.chdir(initialCwd);
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('writes all client and server page modules in one batch', async () => {
    directory = await mkdtemp(join(tmpdir(), 'sendary-batch-'));
    const pagesDirectory = join(directory, 'pages');
    const nestedDirectory = join(pagesDirectory, 'nested');
    const outdir = join(directory, 'output');

    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(join(pagesDirectory, 'index.tsx'), 'export default () => null;');
    await writeFile(join(nestedDirectory, 'about.tsx'), 'export default () => null;');

    process.chdir(directory);
    const pages = await compilePageBatch(
      [join(pagesDirectory, 'index.tsx'), join(nestedDirectory, 'about.tsx')],
      { outdir },
    );

    expect(Object.keys(pages)).toHaveLength(2);
    expect(existsSync(pages[join(pagesDirectory, 'index.tsx')].client)).toBe(true);
    expect(existsSync(pages[join(pagesDirectory, 'index.tsx')].server)).toBe(true);
    expect(existsSync(pages[join(nestedDirectory, 'about.tsx')].client)).toBe(true);
    expect(existsSync(pages[join(nestedDirectory, 'about.tsx')].server)).toBe(true);
  });

  it('can compile only client modules with asset imports omitted for SSR', async () => {
    directory = await mkdtemp(join(tmpdir(), 'sendary-client-batch-'));
    const pagesDirectory = join(directory, 'pages');
    const outdir = join(directory, 'output');
    const page = join(pagesDirectory, 'index.tsx');

    await mkdir(pagesDirectory, { recursive: true });
    await writeFile(page, 'export default () => null;');

    process.chdir(directory);
    const pages = await compilePageBatch([page], { outdir }, true, 'client');

    expect(existsSync(pages[page].client)).toBe(true);
    expect(existsSync(pages[page].server)).toBe(false);
  });

  it('tracks dependencies of pages including imported components', async () => {
    directory = await mkdtemp(join(tmpdir(), 'sendary-deps-batch-'));
    const pagesDirectory = join(directory, 'pages');
    const componentsDirectory = join(directory, 'components');
    const outdir = join(directory, 'output');
    const buttonFile = join(componentsDirectory, 'Button.tsx');
    const pageFile = join(pagesDirectory, 'index.tsx');

    await mkdir(pagesDirectory, { recursive: true });
    await mkdir(componentsDirectory, { recursive: true });
    await writeFile(buttonFile, 'export const Button = () => null;');
    await writeFile(
      pageFile,
      "import { Button } from '../components/Button'; export default () => Button();",
    );

    process.chdir(directory);
    const pages = await compilePageBatch([pageFile], { outdir });

    expect(pages[pageFile].dependencies).toBeDefined();
    expect(pages[pageFile].dependencies!.some((dep) => dep.includes('Button.tsx'))).toBe(
      true,
    );
    expect(pages[pageFile].dependencies!.some((dep) => dep.includes('index.tsx'))).toBe(
      true,
    );
  });
});
