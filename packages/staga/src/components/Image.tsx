import React from 'react';

/**
 * Renders a standard `<img>` element.
 * https://staga.vercel.app/docs/image
 */
export function Image({ src, ...props }: React.ComponentPropsWithoutRef<'img'>) {
  return <img {...props} src={src} />;
}
