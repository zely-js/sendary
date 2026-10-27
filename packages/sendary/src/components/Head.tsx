import { Children, ReactElement, cloneElement, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Adds elements to the document head during SSR and updates them on the client.
 * https://sendary.vercel.app/docs/head
 */
export function Head({ children }: { children: ReactElement | ReactElement[] }) {
  if (typeof window === 'undefined') {
    if (!global.__SENDARY_SSR_DATA__) return null;

    const marked = Children.map(children, (child, index) =>
      cloneElement(child, { 'data-ssr-head': '', key: index } as any),
    );

    global.__SENDARY_SSR_DATA__.head.push({
      type: 'html',
      data: renderToStaticMarkup(marked),
    });

    return null;
  }

  useEffect(() => {
    document.head
      .querySelectorAll('[data-ssr-head]')
      .forEach((element) => element.parentNode?.removeChild(element));

    const template = document.createElement('template');
    template.innerHTML = renderToStaticMarkup(children);
    const nodes = Array.from(template.content.childNodes);

    nodes.forEach((node) => document.head.appendChild(node));

    return () => {
      nodes.forEach((node) => {
        if (document.head.contains(node)) {
          document.head.removeChild(node);
        }
      });
    };
  }, [children]);

  return null;
}
