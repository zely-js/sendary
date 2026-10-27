/**
 * Server-safe implementation of `$sendary-router` used while pages are evaluated
 * in Node during static generation. Kept as source text because the compiler is
 * bundled into a single file.
 */
export const SERVER_ROUTER_MODULE = String.raw`
import * as React from 'react';

const unsupported = (operation) => {
  throw new Error(
    '[sendary-router] ' + operation + ' is only available in a browser. ' +
      'During SSG/SSR, use the URL hooks (useLocation, usePathname, useParams, useSearchQuery, useHash) from a rendered component instead.'
  );
};

const getSSRData = () => {
  const data = globalThis.__SENDARY_SSR_DATA__;
  if (!data) {
    throw new Error(
      '[sendary-router] Router context is unavailable. URL hooks can only run while Sendary is rendering a page during SSR.'
    );
  }
  return data;
};

const subscribe = () => () => {};
const snapshot = () => getSSRData().pathname || '/.sendary/ssr:unknown';

function useLocationSelector(selector) {
  return React.useSyncExternalStore(subscribe, () => selector(snapshot()), () => selector(snapshot()));
}

export function useLocation() {
  return useLocationSelector((url) => url);
}

export function useURL() {
  const location = useLocation();
  return React.useMemo(() => new URL(location, 'http://localhost'), [location]);
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

export function useParams() {
  return getSSRData().params || {};
}

export function useRouter() {
  return { location: useLocation(), push: () => unsupported('router.push()'), replace: () => unsupported('router.replace()') };
}

export const router = new Proxy({}, { get: (_, property) => unsupported('router.' + String(property) + '()') });
`;
