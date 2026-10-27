import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { router, usePathname, useSearchQuery } from '$sendary-router';
import { matchUrlToRoute } from '~/utils/params';
import { prettyURL } from '~/utils/url';
import { hide, show } from './overlay';
import ErrorBoundary, { ErrorBoundaryProps } from './components/error';

function App() {
  const isFirstRender = useRef(true);
  const location = usePathname();
  const search = useSearchQuery();
  const url = decodeURIComponent(new URL(location, window.location.origin).pathname);
  const pageData = router.data.get(prettyURL(url).toLowerCase());
  const page = router.findPage(url);
  const Layout = router.layout._page;
  const rootElement = document.getElementById('_app');

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (rootElement) rootElement.scrollTo({ top: 0, behavior: 'instant' });
  }, [location, search]);

  const createError = (props: any) =>
    React.createElement(
      Layout,
      null,
      React.createElement(router.error._page, {
        key: location,
        ...props,
      }),
    );

  if (!page || pageData?.status === 404) {
    return createError({
      key: location,
      status: 404,
      message: 'Page not found',
      detail: `page: ${JSON.stringify(page)}, loc: ${url}`,
    });
  }

  if (pageData?.status === 500) {
    show(`ERROR: ${pageData.detail}`, true);
    return createError({
      key: location,
      status: 500,
      message: 'Internal Server Error',
    });
  }

  const Page = router.modules[page.path]?._page;

  if (!Page) {
    console.error(`Cannot find page module (path: ${page.path})`);
    return createError({
      key: location,
      status: 500,
      message: 'Page module not found',
    });
  }

  const params = matchUrlToRoute(url, { params: page.params, regex: page.regexp });

  return React.createElement(
    Layout,
    null,
    React.createElement(Page, { key: location, ...pageData, params }),
  );
}

let compilingInterval: ReturnType<typeof setInterval>;

if (import.meta.env.DEV) {
  let dots = 1;
  compilingInterval = setInterval(() => {
    show(`compiling${'.'.repeat(dots)}`);
    dots = (dots % 3) + 1;
  }, 250);
}

router.goto(window.location.href).then(() => {
  const mainComponent = React.createElement(
    ErrorBoundary,
    {
      errorComponent: router.error._page,
      onError(error) {
        console.error(error);
        if (import.meta.env.PROD) {
          show(`An internal client error occurred. See the console for details.`, true);
        } else {
          show(`ERROR: ${error.message}`, true);
        }
      },
    } as ErrorBoundaryProps,
    React.createElement(App, null),
  );

  if (import.meta.env.PROD) {
    ReactDOM.hydrateRoot(document.getElementById('_app'), mainComponent);
  } else {
    const root = ReactDOM.createRoot(document.getElementById('_app'));
    root.render(mainComponent);

    clearInterval(compilingInterval);
    hide();
  }
});
