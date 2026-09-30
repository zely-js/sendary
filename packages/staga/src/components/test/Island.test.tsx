import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Island, resetIslandCounter } from '../Island';

describe('<Island />', () => {
  it('renders its children as static HTML with a deferred-hydration boundary', () => {
    resetIslandCounter();
    const html = renderToStaticMarkup(
      <Island hydrate="visible">
        <button type="button">Open</button>
      </Island>,
    );

    expect(html).toContain('data-staga-island="visible"');
    expect(html).toContain('data-staga-island-id="0"');
    expect(html).toContain('<button type="button">Open</button>');
  });

  it('uses a fresh deterministic island sequence for each document', () => {
    resetIslandCounter();
    const first = renderToStaticMarkup(<Island hydrate="load">one</Island>);
    const second = renderToStaticMarkup(<Island hydrate="idle">two</Island>);

    expect(first).toContain('data-staga-island-id="0"');
    expect(second).toContain('data-staga-island-id="1"');
  });
});
