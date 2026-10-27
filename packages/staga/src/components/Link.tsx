import React from 'react';

type AnchorBaseProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'> & {
  href: string;

  /**
   * Fetch the target page's data before navigating. Enabled by default.
   */
  prefetch?: boolean;
  /**
   * Preload the target page's data during SSR.
   */
  preload?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void | Promise<void>;
};

function isExternal(url: string): boolean {
  try {
    const target = new URL(url, window.location.href);
    return target.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Anchor that navigates between pages without a full reload.
 * https://staga.vercel.app/docs/link
 */
export function Link({
  href,
  onClick,
  prefetch,
  preload,
  children,
  ...props
}: AnchorBaseProps) {
  if (typeof window === 'undefined') {
    if (preload) {
      global.__STAGA_SSR_DATA__?.head.push({ type: 'preload-data-link', data: href });
    }

    return (
      <a {...props} href={href}>
        {children}
      </a>
    );
  }

  const useRouter = window._staga_useRouter;
  const stagaRouter = window._staga_router;
  const router = useRouter();

  if (!isExternal(href) && prefetch !== false) {
    const url = new URL(href, window.location.origin);
    stagaRouter.prefetch(url.pathname);
  }

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target === '_blank') {
      return;
    }

    const current = window.location;
    const target = new URL(href, current.href);

    const isHashOnly = href.startsWith('#');
    const isSamePath = target.pathname === current.pathname;
    const isHashChange = target.hash && target.hash !== current.hash;

    if (isHashOnly || (isSamePath && isHashChange)) {
      return;
    }

    if (onClick) {
      await onClick(e);
      if (e.defaultPrevented) return;
    }

    if (isExternal(href)) {
      window.location.href = href;
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    await stagaRouter.goto(target.pathname);
    router.push(target.pathname + target.search + target.hash);
  };

  return (
    <a {...props} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
