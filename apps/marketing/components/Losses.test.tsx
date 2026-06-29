import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Losses } from './Losses.js';
import { INCIDENTS, MARKET_STATS } from '../lib/lossStats.js';
import { LOSSES } from '../lib/content.js';

/**
 * The section renders to a string via `react-dom/server`, so this needs no DOM:
 * effects (count-up animation, the interval feed) do not run during a static
 * render, which means we assert the truthful, server-rendered content — the
 * cited incidents, the canonical figures, and the illustrative-feed labelling.
 */
const html = renderToStaticMarkup(<Losses />);

describe('<Losses /> static render', () => {
  it('renders the honest framing copy', () => {
    expect(html).toContain(LOSSES.eyebrow);
    expect(html).toContain('Unverifiable inputs cost DeFi billions');
    expect(html).toContain('provable and insurable on Casper');
  });

  it('renders every cited incident with its amount and source', () => {
    for (const incident of INCIDENTS) {
      expect(html).toContain(incident.name);
      expect(html).toContain(incident.amount);
      expect(html).toContain(incident.source.name);
    }
    // Specific headline figures.
    expect(html).toContain('Mango Markets');
    expect(html).toContain('$117M');
    expect(html).toContain('Wormhole');
    expect(html).toContain('$326M');
    expect(html).toContain('Freysa');
    expect(html).toContain('$47K');
    // Citations are present and linked.
    expect(html).toContain('https://www.chainalysis.com/blog/oracle-manipulation-attacks-rising/');
    expect(html).toContain('https://hacken.io/insights/bonqdao-hack/');
  });

  it('renders the count-up stat band with the canonical (a11y) figures', () => {
    for (const stat of MARKET_STATS) {
      expect(html).toContain(stat.label);
      // The exact cited value is exposed to assistive tech / no-JS.
      expect(html).toContain(stat.value);
    }
    expect(html).toContain('$2.2B');
    expect(html).toContain('$200M+');
  });

  it('labels the live feed as an illustrative simulation, not real data', () => {
    expect(html).toContain('Uncovered agent losses');
    expect(html.toLowerCase()).toContain('illustrative');
    expect(html).toContain('not real Casper Network transactions');
    // Each synthetic row carries an "Uncovered" badge.
    expect(html).toContain('Uncovered');
  });
});
