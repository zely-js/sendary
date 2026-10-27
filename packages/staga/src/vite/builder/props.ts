import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { PAGE_STATIC_DATA_FUNCTION } from '~/compiler/constants';
import { compilePages } from '~/core/routing';
import { changeExtension } from '~/utils/path';
import { randomString16 } from '~/utils/random';
import { Spinner } from '~/utils/spinner';

import { getStaticParams, replaceParamsInRoute } from './shared';

/**
 * Runs `getStaticParams` and `getStaticProps` for every page and writes the result to `data/`.
 * https://staga.vercel.app/docs/static-props
 */
export async function createStaticProps(
  pages: Awaited<ReturnType<typeof compilePages>>,
  outdir: string,
) {
  const startTime = performance.now();
  const staticManifest: Record<string, string | null> = {};

  const spinner = new Spinner();

  spinner.message = 'Generating static data';
  spinner.start();

  for (const pageName in pages) {
    spinner.message = `Generating static data - collecting pages (${pageName})`;

    const page = pages[pageName];
    const moduleUrl = pathToFileURL(page.server).href;
    const data = await import(moduleUrl);
    const paramsList = await getStaticParams(
      pageName,
      data,
      'An error occurred while building the page. - Static params function must return array.',
    );

    for (const params of paramsList ?? [null]) {
      const originalURL = replaceParamsInRoute(pageName, params ?? {});
      const outfile = changeExtension(originalURL, '.json').replace(/\//g, '_');

      spinner.message = `Generating static data - ${originalURL}`;

      if (!data[PAGE_STATIC_DATA_FUNCTION]) {
        staticManifest[outfile] = null;
        continue;
      }

      const random = randomString16();
      const outStaticPage = join(outdir, 'data', `${random}.json`);

      mkdirSync(dirname(outStaticPage), { recursive: true });

      staticManifest[outfile] = random;

      const staticProps = params
        ? await data[PAGE_STATIC_DATA_FUNCTION]({ params })
        : await data[PAGE_STATIC_DATA_FUNCTION]();

      writeFileSync(outStaticPage, JSON.stringify(staticProps));
    }
  }

  spinner.stop(
    `Static props generated. (${((performance.now() - startTime) / 1000).toFixed(2)}s)`,
  );

  return staticManifest;
}
