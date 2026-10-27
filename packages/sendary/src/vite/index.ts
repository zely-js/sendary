import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { join, relative } from 'node:path';

import { ConfigEnv, Plugin } from 'vite';

import type { PageManifest } from '$sendary-manifest';

import { BaseConfig } from '~/config/types';
import { initialize, writePagesModule } from '~/core';
import { compilePages } from '~/core/routing';
import { matchUrlToRoute } from '~/utils/params';
import {
  PAGE_STATIC_DATA_FUNCTION,
  PAGE_STATIC_PARAMS_FUNCTION,
} from '~/compiler/constants';
import { scanDirectory } from '~/utils/fs';
import { encodeJSON, prettyURL } from '~/utils/url';
import { convertToRegex } from '~/utils/urlPath';
import { findPage as findPageDev } from '~/utils/find';

import { sendaryBuild } from './build';
import { ServerModule } from './type';
import { changeExtension, isSamePath, normalizePath } from '~/utils/path';
import { debug } from '~/logger';

const manifestModuleId = '$sendary-manifest';
const resolvedManifestModuleId = '\0' + manifestModuleId;
const clientModuleId = '$sendary-client';
const resolvedClientModuleId = '\0' + clientModuleId;
const routerModuleId = '$sendary-router';
const resolvedRouterModuleId = '\0' + routerModuleId;

/**
 * Creates the Vite plugins that compile pages, serve dev data, and build the static site.
 * https://sendary.vercel.app/docs/installation
 */
export function sendary(options?: BaseConfig): Plugin[] {
  const isDev = process.env.NODE_ENV === 'development';
  const dist = options?.compileOptions?.outdir ?? join(process.cwd(), '.sendary');
  const _manifest_object: PageManifest[] = [];
  const _server_props = new Map<string, any>();

  let _pages: Record<string, { server: string; client: string; dependencies?: string[] }>;
  let _manifest: string | null = null;
  let logger: import('vite').Logger;
  let env: ConfigEnv;

  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });

  mkdirSync(dist);

  function generateManifest(
    rawManif: Awaited<ReturnType<typeof compilePages>>,
    force: boolean = false,
  ): string {
    if (_manifest && !force) return _manifest;

    _manifest_object.length = 0;

    const manifest: string[] = [];

    for (const pagePath in rawManif) {
      const converted = convertToRegex(pagePath);
      const relativePath = relative(dist, rawManif[pagePath].client).replace(/\\/g, '/');
      const code = `{path: ${JSON.stringify(pagePath)}, regexp: ${converted.regex.toString()}, params: ${JSON.stringify(converted.params)}, buildPath: ${JSON.stringify(relativePath)}, originalPath: ${JSON.stringify(pagePath)}}`;

      manifest.push(code);
      _manifest_object.push({
        path: pagePath,
        originalPath: pagePath,
        regexp: converted.regex,
        params: converted.params,
        buildPath: relativePath,
        buildServerPath: rawManif[pagePath].server,
      });
    }

    _manifest = `export const PAGES_MANIFEST = [\n  ${manifest.join(',\n  ')}\n]`;

    return _manifest;
  }

  const findPage = (url: string) => findPageDev(url, _manifest_object);

  return [
    {
      name: 'sendary',

      config(config, _env) {
        env = _env;

        config.server ??= {};
        config.server.watch ??= {};
        config.server.watch.ignored = [
          dist,
          join(dist, '**'),
          ...(Array.isArray(config.server.watch.ignored)
            ? config.server.watch.ignored
            : config.server.watch.ignored
              ? [config.server.watch.ignored]
              : []),
        ];

        config.resolve ??= {};
        config.resolve.alias ??= {};
        config.resolve.alias['$sendary-pages'] = join(
          env.command === 'serve' ? dist : config.build.outDir || 'dist',
          'manifest.js',
        );
      },

      configResolved(config) {
        logger = config.logger;
      },

      async handleHotUpdate({ server, file }) {
        if (file.includes('.sendary')) return [];

        _pages = await compilePages(options?.compileOptions);
        _server_props.clear();

        const beforeManifest = `${_manifest}`;
        const afterManifest = generateManifest(_pages, true);

        if (beforeManifest !== afterManifest) {
          server.ws.send({ type: 'full-reload' });
          return [];
        }

        writePagesModule(dist, _pages);

        const invalidateAndUpdate = (modid: any, isVirtual = true) => {
          if (!modid) return;

          const mod = server.moduleGraph.getModuleById(modid);

          if (!mod) return;

          server.moduleGraph.invalidateModule(mod);

          server.ws.send({
            type: 'update',
            updates: [
              {
                type: 'js-update',
                path: isVirtual ? '/@id/' + mod.id : mod.url,
                acceptedPath: isVirtual ? '/@id/' + mod.id : mod.url,
                timestamp: Date.now(),
              },
            ],
          });
        };

        invalidateAndUpdate(resolvedManifestModuleId);
        invalidateAndUpdate(
          (await server.moduleGraph.getModuleByUrl('$sendary-pages'))?.id ?? null,
        );

        const targetNormalized = normalizePath(file);
        const pagesDirectory = join(process.cwd(), 'pages');
        const pagesFiles = existsSync(pagesDirectory)
          ? scanDirectory(pagesDirectory).map((p) => normalizePath(p))
          : [];

        // Find all pages affected by the changed file (either directly or via dependencies)
        const affectedPages: Array<{
          server: string;
          client: string;
          dependencies?: string[];
        }> = [];

        for (const page of Object.values(_pages)) {
          if (!page) continue;
          const isDep = page.dependencies?.some((dep) => isSamePath(dep, file));
          const isClientOrServer =
            isSamePath(page.client, file) || isSamePath(page.server, file);
          if (isDep || isClientOrServer) {
            affectedPages.push(page);
          }
        }

        if (pagesFiles.includes(targetNormalized)) {
          const compiledFile = changeExtension(
            join(process.cwd(), '.sendary', 'client', relative(pagesDirectory, file)),
            '.js',
          );
          for (const page of Object.values(_pages)) {
            if (page && isSamePath(page.client, compiledFile)) {
              if (!affectedPages.includes(page)) {
                affectedPages.push(page);
              }
            }
          }
        }

        const findModulesByFile = (targetCompiledFile: string) => {
          const matched = new Set<import('vite').ModuleNode>();
          const target = normalizePath(targetCompiledFile);

          for (const mod of server.moduleGraph.urlToModuleMap.values()) {
            if (mod.file && normalizePath(mod.file) === target) {
              matched.add(mod);
            }
          }

          for (const mod of server.moduleGraph.idToModuleMap.values()) {
            if (mod.file && normalizePath(mod.file) === target) {
              matched.add(mod);
            }
          }

          return Array.from(matched);
        };

        for (const page of affectedPages) {
          const modules = findModulesByFile(page.client);
          for (const mod of modules) {
            invalidateAndUpdate(mod.id, false); // HMR update
          }
        }

        logger.info(
          `${'[sendary]'.gray} ${relative(process.cwd(), file).cyan.bold} updated`,
          {},
        );

        if (affectedPages.length > 0) {
          return [];
        }
      },

      async buildStart() {
        _pages = await compilePages(options?.compileOptions);
      },

      async configureServer(server) {
        server.watcher.unwatch(dist);

        _pages = await compilePages(options?.compileOptions);

        initialize(options?.compileOptions?.outdir, _pages);

        if (isDev) {
          server.middlewares.use('/.sendary/__page_data', async (req, res) => {
            const url = new URL(req.url, 'http://localhost');
            const page = url.searchParams.get('page') || '/';

            debug(`Requested "${page}"`);

            if (page === '$IS_CONNECTED$') {
              return res.end(JSON.stringify({ connected: true }));
            }

            const clientURL = new URL(page, 'http://localhost');

            const pageManifest = findPage(page);
            const prettyPathname = prettyURL(decodeURIComponent(clientURL.pathname));

            res.setHeader('Content-Type', 'application/json');

            if (!pageManifest?.buildServerPath)
              return res.end(JSON.stringify({ props: {}, status: 404 }));

            if (_server_props.has(prettyPathname)) {
              return res.end(
                JSON.stringify({
                  props: _server_props.get(prettyPathname),
                  status: 200,
                  cached: true,
                }),
              );
            }

            try {
              const moduleUrl = pathToFileURL(pageManifest.buildServerPath).href;
              const serverModule: ServerModule = await import(
                `${moduleUrl}?v=${Date.now()}`
              );

              const params = matchUrlToRoute(clientURL.pathname, {
                regex: pageManifest.regexp,
                params: pageManifest.params,
              });

              let data = {};

              if (serverModule[PAGE_STATIC_PARAMS_FUNCTION]) {
                const availableParams = await serverModule[PAGE_STATIC_PARAMS_FUNCTION]();

                const valid = availableParams.some((allowedParams) =>
                  isDeepStrictEqual(encodeJSON(allowedParams), params),
                );

                if (!valid) {
                  return res.end(JSON.stringify({ props: {}, status: 404 }));
                }
              }

              if (serverModule[PAGE_STATIC_DATA_FUNCTION]) {
                data = await serverModule[PAGE_STATIC_DATA_FUNCTION]({
                  params,
                });
              }
              _server_props.set(prettyPathname, data);
              res.end(JSON.stringify({ props: data, status: 200 }));
              debug(`Request ended "${page}"`);
            } catch (e) {
              console.error(e);
              res.end(
                JSON.stringify({
                  message: 'Internal Server Error',
                  detail: e.message,
                  status: 500,
                }),
              );
            }
          });
        }
      },

      transformIndexHtml(html) {
        return html.replace('%body%', '<div id="_app"></div>');
      },

      resolveId(id) {
        if (id === manifestModuleId) {
          return resolvedManifestModuleId;
        } else if (id === clientModuleId) {
          return resolvedClientModuleId;
        } else if (id === routerModuleId) {
          return resolvedRouterModuleId;
        }
      },

      load(id) {
        if (id === resolvedClientModuleId) {
          return {
            code: readFileSync(join(__dirname, 'client.mjs'), 'utf-8'),
          };
        } else if (id === resolvedManifestModuleId) {
          return {
            code: generateManifest(_pages),
          };
        } else if (id === resolvedRouterModuleId) {
          return {
            code: readFileSync(join(__dirname, 'router.mjs'), 'utf-8'),
          };
        }
      },
    },
    sendaryBuild(options?.compileOptions || {}),
  ];
}
