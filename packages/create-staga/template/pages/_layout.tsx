import type { ReactNode } from 'react';

import { Link } from 'staga/components';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav>
        <Link href="/">Home</Link> <Link href="/post/hello">Example post</Link>
      </nav>

      <main>{children}</main>
    </>
  );
}
