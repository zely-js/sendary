import { PageManifest } from '$staga-manifest';

export const findPage = (url: string, manifest: PageManifest[]): PageManifest | null => {
  const sortedManifest = [...manifest].sort((a, b) => a.params.length - b.params.length);

  for (const route of sortedManifest) {
    if (
      route.regexp.test(decodeURIComponent(url)) &&
      !route.path.startsWith('[') &&
      !route.path.endsWith(']')
    ) {
      return route;
    }
  }

  return null;
};
