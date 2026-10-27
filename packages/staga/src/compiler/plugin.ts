import { Plugin } from 'esbuild';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { CompileOptions } from '~/config/types';
import { SERVER_ROUTER_MODULE } from './server-router';

const BUILTIN_MODULES = builtinModules.concat(builtinModules.map((m) => `node:${m}`));
const DEFAULT_ASSET_EXTENSIONS = ['.css', '.scss', '.sass', '.less'];

export function sideEffectPlugin(options?: CompileOptions): Plugin {
  return {
    name: 'staga/esbuild-sideeffect-plugin',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (
          BUILTIN_MODULES.includes(args.path) ||
          (options?.ignoreSideEffects &&
            (options?.preserveSideEffects || []).includes(args.path))
        ) {
          return {
            sideEffects: false,
            path: args.path,
            external: true,
          };
        }
      });
    },
  };
}

/**
 * Replaces `$staga-router` with a server-safe implementation while pages are
 * evaluated by Node during static generation.
 */
export function vmPlugin(): Plugin {
  return {
    name: 'staga/esbuild-router-plugin',
    setup(build) {
      build.onResolve({ filter: /^\$staga-router$/ }, (args) => {
        return { path: args.path, namespace: 'virtual' };
      });

      build.onLoad({ filter: /^\$staga-router$/, namespace: 'virtual' }, () => {
        return {
          contents: SERVER_ROUTER_MODULE,
          loader: 'js',
          resolveDir: process.cwd(),
        };
      });
    },
  };
}

/**
 * Keeps asset imports out of server bundles and marks them external in client bundles.
 */
export function assetPlugin(
  extensions: string[] = DEFAULT_ASSET_EXTENSIONS,
  ignoreAssets = false,
  options?: CompileOptions,
): Plugin {
  const allExtensions = options?.assetsExtensions
    ? [...extensions, ...options.assetsExtensions]
    : extensions;

  return {
    name: 'staga/esbuild-asset-plugin',
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(
            `\\.(${allExtensions.map((ext) => ext.replace('.', '')).join('|')})$`,
          ),
        },
        (args) => {
          if (ignoreAssets) {
            return {
              path: args.path,
              namespace: 'staga:ignore',
            };
          }
          if (args.path.startsWith('.')) {
            return {
              path: join(args.resolveDir, args.path),
              external: true,
            };
          }

          return {
            path: args.path,
            external: true,
          };
        },
      );
      build.onLoad({ filter: /.*/, namespace: 'staga:ignore' }, () => {
        return {
          contents: '',
          loader: 'js',
        };
      });
    },
  };
}
