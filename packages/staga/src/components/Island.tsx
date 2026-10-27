import React, { ReactNode, useEffect, useRef } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

export type IslandHydration = 'load' | 'idle' | 'visible';

export interface IslandProps {
  /**
   * When this subtree becomes interactive.
   * @default 'visible'
   */
  hydrate?: IslandHydration;
  children: ReactNode;
}

let islandIndex = 0;

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
 * Defers hydration of a subtree until it is needed.
 *
 * Children are rendered as static HTML during SSR. The browser turns the
 * boundary into a separate React root when the selected strategy fires.
 * https://staga.vercel.app/docs/island
 */
export function Island({ hydrate = 'visible', children }: IslandProps) {
  const isServer = typeof window === 'undefined';
  const id = useRef<number | null>(null);
  if (id.current === null) id.current = islandIndex++;

  const elementRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const hydratedRef = useRef(false);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  if (isServer) {
    return (
      <div
        data-staga-island={hydrate}
        data-staga-island-id={id.current}
        dangerouslySetInnerHTML={{ __html: renderToStaticMarkup(children) }}
      />
    );
  }

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

      const hasContent = element.hasChildNodes();
      const root = hasContent
        ? hydrateRoot(element, childrenRef.current)
        : createRoot(element);

      if (!hasContent) root.render(childrenRef.current);
      rootRef.current = root;
    };

    const cancel = scheduleHydration(element, hydrate, start);

    return () => {
      cancel();
      rootRef.current?.unmount();
      rootRef.current = null;
      hydratedRef.current = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (hydratedRef.current) {
      rootRef.current?.render(children);
    }
  }, [children]);

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
