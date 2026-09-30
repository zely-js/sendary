import { Plugin } from 'esbuild';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { CompileOptions } from '~/config/types';
import { SERVER_ROUTER_MODULE } from './server-router';

const BUILTIN_MODULES = builtinModules.concat(builtinModules.map((m) => `node:${m}`));

export function sideEffectPlugin(options?: CompileOptions): Plugin {
  return {
    name: 'staga/esbuild-sideeffect-plugin',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
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
 * Supplies a render-safe `$staga-router` implementation to Node's build-time
 * bundle.  An empty object makes any named router import undefined and causes
 * an opaque "is not a function" failure when a page is rendered or evaluated.
 */
export function vmPlugin(): Plugin {
  return {
    name: 'my-virtual-module-plugin',
    setup(build) {
      build.onResolve({ filter: /^\$staga-router$/ }, (args) => {
        return { path: args.path, namespace: 'virtual' };
      });

      build.onLoad({ filter: /^\$staga-router$/, namespace: 'virtual' }, () => {
        return {
          contents: SERVER_ROUTER_MODULE,
          loader: 'js',
          // The virtual module imports React. Without a resolve directory,
          // esbuild cannot look up the consumer project's node_modules.
          resolveDir: process.cwd(),
        };
      });
    },
  };
}

export function onlyReact(
  extensions: string[] = ['.css', '.scss', '.sass', '.less'],
  isServerSide: boolean = false,
  options?: CompileOptions,
): Plugin {
  if (options.assetsExtensions) {
    extensions.push(...options.assetsExtensions);
  }

  return {
    name: 'staga/esbuild-react-plugin',
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(
            `\\.(${extensions.map((ext) => ext.replace('.', '')).join('|')})$`,
          ),
        },

        (args) => {
          if (isServerSide) {
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
