import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';

import { vmPlugin } from '../plugin';
import { SERVER_ROUTER_MODULE } from '../server-router';

describe('build-time $staga-router module', () => {
  it('preserves the URL-router API instead of replacing it with an empty module', () => {
    expect(SERVER_ROUTER_MODULE).toContain('export function useLocation()');
    expect(SERVER_ROUTER_MODULE).toContain('export function useParams()');
    expect(SERVER_ROUTER_MODULE).toContain('export function useRouter()');
    expect(SERVER_ROUTER_MODULE).not.toContain('module.exports = {}');
  });

  it('makes browser-only navigation fail with an actionable message', () => {
    expect(SERVER_ROUTER_MODULE).toContain('only available in a browser');
  });

  it('resolves named router imports in the Node build bundle', async () => {
    const result = await build({
      stdin: {
        contents: `import { useParams, usePathname } from '$staga-router'; export { useParams, usePathname };`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      plugins: [vmPlugin()],
    });

    const output = result.outputFiles[0].text;
    expect(output).toContain('function useParams');
    expect(output).toContain('function usePathname');
  });
});
