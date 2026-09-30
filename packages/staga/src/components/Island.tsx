import React, { ReactNode, useEffect, useRef } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

export type IslandHydration = 'load' | 'idle' | 'visible';

export interface IslandProps {
  /** When this interactive subtree becomes a React root. */
  hydrate?: IslandHydration;
  children: ReactNode;
}

let islandIndex = 0;

/** @internal Reset once for every independent SSR document render. */
export function resetIslandCounter() {
  islandIndex = 0;
}

function scheduleHydration(
  element: HTMLDivElement,
  strategy: IslandHydration,
  hydrate: () => void,
): () => void {
  if (strategy === 'load') {
    hydrate();
    return () => {};
  }

  if (strategy === 'idle') {
    const browser = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const timeout = window.setTimeout(hydrate, 200);
    const idleId = browser.requestIdleCallback?.(() => {
      window.clearTimeout(timeout);
      hydrate();
    });

    return () => {
      window.clearTimeout(timeout);
      if (idleId !== undefined) browser.cancelIdleCallback?.(idleId);
    };
  }

  if (!('IntersectionObserver' in window)) {
    hydrate();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      hydrate();
    },
    { rootMargin: '200px' },
  );
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Marks a subtree as an independently hydrated React island.
 *
 * Staga renders children to HTML during SSR, then leaves that HTML untouched
 * until the selected strategy runs in the browser. The wrapper is necessary
 * to retain an SSR DOM boundary; it has no styling or layout behaviour.
 */
export function Island({ hydrate = 'visible', children }: IslandProps) {
  const isServer = typeof window === 'undefined';
  const id = useRef<number | null>(null);
  if (id.current === null) id.current = islandIndex++;

  const elementRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const hydratedRef = useRef(false);

  if (isServer) {
    return (
      <div
        data-staga-island={hydrate}
        data-staga-island-id={id.current}
        dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(children) }}
      />
    );
  }

  // During the initial document hydration, return exactly the HTML that SSR
  // placed in this boundary. React therefore does not walk the island's child
  // tree as part of the application root hydration.
  const existing = document.querySelector<HTMLDivElement>(
    `[data-staga-island-id="${id.current}"]`,
  );
  const serverHTML = existing?.innerHTML;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const start = () => {
      if (hydratedRef.current) return;
      hydratedRef.current = true;
      rootRef.current = element.hasChildNodes()
        ? hydrateRoot(element, children)
        : createRoot(element);

      if (!element.hasChildNodes()) rootRef.current.render(children);
    };

    const cancel = scheduleHydration(element, hydrate, start);
    return () => {
      cancel();
      rootRef.current?.unmount();
      rootRef.current = null;
      hydratedRef.current = false;
    };
  }, [children, hydrate]);

  return (
    <div
      ref={elementRef}
      data-staga-island={hydrate}
      data-staga-island-id={id.current}
      dangerouslySetInnerHTML={
        serverHTML === undefined ? undefined : { __html: serverHTML }
      }
    />
  );
}
