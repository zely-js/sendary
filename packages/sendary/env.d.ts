/* eslint-disable @typescript-eslint/no-misused-new */

// $sendary-manifest module is page map for internal core routing.
declare module '$sendary-manifest' {
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

declare module '$sendary-pages' {
  const pages: Record<string, () => Promise<any>>;
  export = pages;
}

declare module '$sendary-router' {
  import { PageManifest } from '$sendary-manifest';

  type SendaryLayout = (props: { children: React.ReactNode }) => React.ReactNode;
  type SendaryErrorComponent = (props: ErrorProps) => React.ReactNode;

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
   * https://sendary.vercel.app/docs/sendary-router
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
   * https://sendary.vercel.app/docs/sendary-router
   */
  export interface Router {
    routes: PageManifest[];

    layout: { _page: SendaryLayout };

    error: { _page: SendaryErrorComponent };

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
