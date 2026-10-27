import { PAGES_MANIFEST as manifest, PageManifest } from '$staga-manifest';
import pages from '$staga-pages';
import React from 'react';
import { isSamePathClient, removeExtension } from '~/utils/clientPath';
import { prettyURL } from '~/utils/url';
import { matchUrlToRoute } from '~/utils/params';
import { findPage as findPageDev } from '~/utils/find';
import { DefaultLayout } from './components/_layout.';
import { DefaultError } from './components/_error';

const isServerSide = typeof window === 'undefined';

const staticManifest: Record<string, string | null> = isServerSide
  ? {}
  : JSON.parse(document.getElementById('__STATIC_MANIFEST__')?.innerText || '{}');

declare global {
  interface Window {
    __STAGA_PAGEMAP__: Record<string, string>;
  }
}

export async function loadPageData(page: string): Promise<any> {
  if (import.meta.env.DEV) {
    const res = await fetch(`/.staga/__page_data?page=${page}`);
    return await res.json();
  }

  const id = staticManifest[page.replace(/\//g, '_') + '.json'];

  if (id === null) {
    return { props: {} };
  }

  if (id === undefined) {
    return { props: {}, status: 404 };
  }

  const target = `/data/${id}.json`;

  try {
    const res = await fetch(target);
    return { props: await res.json() };
  } catch (error) {
    console.error(`Cannot find page (fetching ${target}) - ${(error as Error).message}`);
    return { props: {}, status: 404 };
  }
}

function createHistoryStore() {
  if (isServerSide) {
    return {
      subscribe() {
        return () => {};
      },
      getSnapshot() {
        return globalThis.__STAGA_SSR_DATA__.pathname;
      },
      push() {},
      replace() {},
    };
  }

  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const wrap = (method: 'pushState' | 'replaceState') => {
    const original = history[method];
    return function (...args: Parameters<History['pushState']>) {
      original.apply(history, args);
      notify();
    };
  };

  history.pushState = wrap('pushState');
  history.replaceState = wrap('replaceState');

  window.addEventListener('popstate', notify);

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return decodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash,
      );
    },
    push(path: string) {
      if (path.startsWith('#')) {
        location.hash = path;
        return;
      }

      history.pushState({}, '', path);
    },
    replace(path: string) {
      history.replaceState({}, '', path);
    },
  };
}

const historyStore = createHistoryStore();

const getSSRPathname = () => {
  if (!isServerSide) {
    return window.location.pathname;
  }
  return globalThis?.__STAGA_SSR_DATA__?.pathname ?? undefined;
};

function useLocationSelector<T>(selector: (url: string) => T) {
  return React.useSyncExternalStore(
    historyStore.subscribe,
    () => selector(historyStore.getSnapshot()),
    () => selector(getSSRPathname() ?? '/.staga/ssr:unknown'),
  );
}

/**
 * Returns the current pathname, search query, and hash.
 * https://staga.vercel.app/docs/staga-router
 */
export function useLocation() {
  return useLocationSelector((url) => url);
}

export function useURL() {
  const url = useLocation();
  return React.useMemo(() => new URL(url, 'http://localhost'), [url]);
}

export function usePathname() {
  return useLocationSelector((url) => new URL(url, 'http://localhost').pathname);
}

export function useSearchQuery() {
  const search = useLocationSelector((url) => new URL(url, 'http://localhost').search);

  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export function useHash() {
  return useLocationSelector((url) => new URL(url, 'http://localhost').hash);
}

export function useRouter() {
  const location = useLocation();
  return {
    location,
    push: historyStore.push,
    replace: historyStore.replace,
  };
}

export function useParams() {
  if (isServerSide) {
    return globalThis.__STAGA_SSR_DATA__.params || {};
  }

  const location = usePathname();
  const page = window._staga_router.findPage(location);

  if (!page) {
    throw new Error(
      `[staga-router] Cannot generate params: Route match for "${location}" is missing required data.`,
    );
  }

  return matchUrlToRoute(location, { params: page.params, regex: page.regexp });
}

/**
 * Loads page modules and static data for client-side navigation.
 * https://staga.vercel.app/docs/staga-router
 */
export class Router {
  routes: PageManifest[];

  layout: any;

  error: any;

  modules: Record<string, any> = {};

  data: Map<string, any> = new Map();

  loadedModules: Map<string, any> = new Map();

  hook: EventTarget;

  constructor(routes: PageManifest[]) {
    this.hook = new EventTarget();
    this.routes = routes;
  }

  async prefetch(url: string) {
    const key = prettyURL(url);
    if (this.data.has(key)) return;
    this.data.set(key, await loadPageData(url));
  }

  getHref(page: PageManifest): string | undefined {
    if (import.meta.env.DEV) {
      return `/.staga/${page.buildPath.replace(/\\/g, '/')}`;
    }

    const pageMap = window.__STAGA_PAGEMAP__;

    for (const pageMapKey in pageMap) {
      if (
        isSamePathClient(removeExtension(pageMapKey), removeExtension(page.originalPath))
      ) {
        return `/${pageMap[pageMapKey]}`;
      }
    }
  }

  preload(page: PageManifest) {
    const href = this.getHref(page);

    if (!href) return;

    const existingLinks = document.getElementsByTagName('link');

    for (const link of [...existingLinks]) {
      if (link.href === new URL(href, window.location.origin).href) return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  preloadAllPages() {
    for (const route of this.routes) {
      this.preload(route);
    }
  }

  async loadLayout() {
    if (this.layout) return this.layout;

    this.layout = pages['[layout]']
      ? await pages['[layout]']()
      : { _page: DefaultLayout };

    return this.layout;
  }

  async loadError() {
    if (this.error) return this.error;

    this.error = pages['[error]'] ? await pages['[error]']() : { _page: DefaultError };

    return this.error;
  }

  findPage(url: string) {
    return findPageDev(url.toLowerCase(), this.routes);
  }

  async goto(href: string) {
    this.hook.dispatchEvent(new Event('load:start'));

    const url = decodeURIComponent(
      new URL(href, window.location.origin).pathname,
    ).toLowerCase();
    const page = this.findPage(url);

    if (!page) {
      await Promise.all([this.loadLayout(), this.loadError()]);
      this.hook.dispatchEvent(new Event('load:end'));
      return;
    }

    const key = prettyURL(url);
    const pageModule = this.loadedModules.has(page.path)
      ? Promise.resolve(this.loadedModules.get(page.path))
      : pages[page.path]().then((module) => {
          this.loadedModules.set(page.path, module);
          return module;
        });
    const data = this.data.has(key)
      ? Promise.resolve(this.data.get(key))
      : loadPageData(url).then((pageData) => {
          this.data.set(key, pageData);
          return pageData;
        });

    const [, , loadedModule, loadedData] = await Promise.all([
      this.loadLayout(),
      this.loadError(),
      pageModule,
      data,
    ]);

    this.modules[page.path] = loadedModule;
    this.hook.dispatchEvent(new Event('load:end'));

    if (loadedData?.status === 404) {
      return;
    }

    return { modules: this.modules, data: loadedData };
  }
}

export const router = new Router(manifest);

if (!isServerSide) {
  window._staga_router = router as any as import('$staga-router').Router;
  window._staga_useRouter = useRouter as any as typeof import('$staga-router').useRouter;
}

declare global {
  interface Window {
    _staga_router: import('$staga-router').Router;
    _staga_useRouter: typeof import('$staga-router').useRouter;
  }
}
