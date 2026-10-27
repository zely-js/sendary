/* eslint-disable @typescript-eslint/no-misused-new */

// $staga-manifest module is page map for internal core routing.
declare module '$staga-manifest' {
  export interface PageManifest {
    regexp: RegExp;
    path: string;
    originalPath: string;
    params: string[];
    buildPath: string;
    buildServerPath: string;
    allowedParams?: Record<string, string[]>;
  }

  export const PAGES_MANIFEST: PageManifest[];
}

declare module '$staga-pages' {
  const pages: Record<string, () => Promise<any>>;
  export = pages;
}

declare module '$staga-router' {
  import { PageManifest } from '$staga-manifest';

  type StagaLayout = (props: { children: React.ReactNode }) => React.ReactNode;
  type StagaErrorComponent = (props: ErrorProps) => React.ReactNode;

  interface RouteResult {
    regex: RegExp;
    params: string[];
  }

  interface LoaderEventMap {
    'load:start': void;
    'load:end': void;
  }

  declare class LoaderHook extends EventTarget {
    addEventListener<K extends keyof LoaderEventMap>(
      type: K,
      listener: (ev: CustomEvent<void>) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener<K extends keyof LoaderEventMap>(
      type: K,
      listener: (ev: CustomEvent<void>) => void,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  /**
   * Returns the current location.
   * https://staga.vercel.app/docs/staga-router
   */
  export function useLocation(): string;

  export function useRouter(): {
    location: string;
    push: (path: any) => void;
    replace: (path: any) => void;
  };

  export function useParams(): {
    [key: string]: string;
  };

  /**
   * Returns `url.pathname`.
   */
  export function usePathname(): string;

  export function useHash(): string;

  /**
   * Returns `url.search` as `URLSearchParams`.
   */
  export function useSearchQuery(): URLSearchParams;

  /**
   * Client router used by `<Link>` for navigation and data loading.
   * https://staga.vercel.app/docs/staga-router
   */
  export interface Router {
    routes: PageManifest[];

    layout: { _page: StagaLayout };

    error: { _page: StagaErrorComponent };

    /**
     * Loaded page components.
     */
    modules: Record<string, any>;

    /**
     * Loaded page data.
     */
    data: Map<string, any>;

    hook: LoaderHook;

    constructor(routes: PageManifest[]);

    /**
     * Preload a page module.
     */
    preload(page: PageManifest): void;

    /**
     * Preload every page module.
     */
    preloadAllPages(): void;

    /**
     * Load the layout component.
     */
    loadLayout(): Promise<any>;

    /**
     * Load the error component.
     */
    loadError(): Promise<any>;

    /**
     * Find the page that matches a URL.
     */
    findPage(url: string): PageManifest | null;

    /**
     * Load the layout, error page, page module, and static data for a URL.
     */
    goto(href: string): Promise<{ modules: any; data: any } | undefined>;

    /**
     * Fetch and cache static data for a URL.
     */
    prefetch(url: string): Promise<void>;
  }

  export const router: Router;
}

interface Window {
  __overlay__: {
    show(text: string, error?: boolean): void;
    hide(): void;
    setText(text: string): void;
  };
}
