'use client';

/**
 * "Real money lost" — the loss-awareness section.
 *
 * Three parts, all dark-theme + Casper-red brand:
 *  1. A count-up stat band of real, cited market figures (loss amounts in the
 *     fail-red token).
 *  2. An auto-scrolling marquee of real, cited exploit incidents.
 *  3. An explicitly *illustrative* "uncovered agent losses" feed — synthetic
 *     rows appended on an interval, clearly labelled as a simulation so nothing
 *     is mistaken for real Casper data.
 *
 * Animation primitives (`useCountUp`, `<Reveal>`, `.cp-marquee`, `.cp-pulse`,
 * `.cp-fade-in`) come from `@casperproof/ui`. All motion respects
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react';
import { Card, Badge, Reveal, useCountUp, prefersReducedMotion } from '@casperproof/ui';
import { INCIDENTS, MARKET_STATS, CATEGORY_LABELS } from '../lib/lossStats';
import type { LossIncident, MarketStat } from '../lib/lossStats';
import { LOSSES } from '../lib/content';
import { groupThousands } from '../lib/format';

/* --- Count-up stat band --------------------------------------------------- */

/** One big animated figure. The canonical `value` is exposed to assistive tech. */
function LossStat({ stat }: { stat: MarketStat }): JSX.Element {
  const counted = useCountUp(stat.to, { durationMs: 1600, decimals: stat.decimals });
  return (
    <div className="mk-loss-stat">
      <span className="mk-loss-stat__value">
        <span aria-hidden="true">
          {stat.prefix}
          {counted}
          {stat.suffix}
        </span>
        {/* The exact, cited figure for screen readers + no-JS + SEO. */}
        <span className="cp-sr-only">{stat.value}</span>
      </span>
      <span className="mk-loss-stat__label">{stat.label}</span>
      <span className="mk-loss-stat__note">{stat.note}</span>
      {stat.source.url ? (
        <a
          className="mk-loss-stat__source"
          href={stat.source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source: {stat.source.name}
        </a>
      ) : (
        <span className="mk-loss-stat__source">Source: {stat.source.name}</span>
      )}
    </div>
  );
}

/* --- Incident marquee ----------------------------------------------------- */

/** A single cited-incident card used inside the marquee track. */
function IncidentCard({
  incident,
  duplicate = false,
}: {
  incident: LossIncident;
  duplicate?: boolean;
}): JSX.Element {
  return (
    <article className="mk-loss-incident" aria-hidden={duplicate || undefined}>
      <div className="mk-loss-incident__head">
        <span className="mk-loss-incident__name">{incident.name}</span>
        <span className="mk-loss-tag">{CATEGORY_LABELS[incident.category]}</span>
      </div>
      <p className="mk-loss-incident__amount">{incident.amount}</p>
      <p className="mk-loss-incident__date">{incident.date}</p>
      <p className="mk-loss-incident__cause">{incident.cause}</p>
      {incident.source.url ? (
        <a
          className="mk-loss-incident__source"
          href={incident.source.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={duplicate ? -1 : undefined}
        >
          Source: {incident.source.name}
        </a>
      ) : (
        <span className="mk-loss-incident__source">Source: {incident.source.name}</span>
      )}
    </article>
  );
}

/* --- Illustrative live feed ---------------------------------------------- */

/** Loss types shown in the illustrative feed. */
const FEED_TYPES = ['oracle', 'exploit', 'agent-error', 'liveness'] as const;
type FeedType = (typeof FEED_TYPES)[number];

const FEED_TYPE_LABELS: Record<FeedType, string> = {
  oracle: 'Oracle',
  exploit: 'Exploit',
  'agent-error': 'Agent error',
  liveness: 'Liveness',
};

interface FeedRow {
  id: number;
  bornTick: number;
  addr: string;
  type: FeedType;
  amount: string;
}

/** How many synthetic rows are kept on screen. */
const MAX_ROWS = 6;
/** Interval between synthetic events (ms). */
const STEP_MS = 2600;
/** Illustrative seconds represented by one tick (for the relative timestamp). */
const STEP_S = 4;
/** Tick the seeded rows are anchored to (so the feed starts populated). */
const SEED_TICK = 4;

/** Small deterministic PRNG so every render/seed is reproducible (no `Date`). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a deterministic element from a non-empty list. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Deterministic short hex run. */
function hex(rng: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i += 1) s += Math.floor(rng() * 16).toString(16);
  return s;
}

/** Build a deterministic synthetic row for a given tick. */
function makeRow(tick: number): FeedRow {
  const rng = mulberry32((tick + 1) * 0x9e3779b1);
  const type = pick(FEED_TYPES, rng);
  const addr = `0x${hex(rng, 4)}…${hex(rng, 4)}`;
  const amount = `$${groupThousands(String(Math.floor(150 + rng() * 84000)))}`;
  return { id: tick, bornTick: tick, addr, type, amount };
}

/** The initial, server-safe seeded feed (newest first). */
function seedFeed(): FeedRow[] {
  return [SEED_TICK, SEED_TICK - 1, SEED_TICK - 2, SEED_TICK - 3].map(makeRow);
}

/** Relative-age label for a row (purely illustrative). */
function ageLabel(seconds: number): string {
  return seconds <= 0 ? 'just now' : `${seconds}s ago`;
}

/** The illustrative, clearly-labelled "uncovered agent losses" feed. */
function LiveFeed(): JSX.Element {
  const [feed, setFeed] = useState<FeedRow[]>(() => seedFeed());
  const [tick, setTick] = useState(SEED_TICK);
  const tickRef = useRef(SEED_TICK);

  useEffect(() => {
    // Appending rows is motion — honour the user's preference and stay static.
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      tickRef.current += 1;
      const next = tickRef.current;
      setTick(next);
      setFeed((prev) => [makeRow(next), ...prev].slice(0, MAX_ROWS));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="mk-loss-feed">
      <div className="mk-loss-feed__head">
        <h3 className="mk-card-title" style={{ margin: 0 }}>
          {LOSSES.feedTitle}
        </h3>
        <Badge status="challenged" className="cp-pulse">
          Illustrative · simulated
        </Badge>
      </div>
      <p className="mk-loss-feed__note">{LOSSES.feedNote}</p>
      <ul className="mk-loss-feed__list" aria-label="Illustrative simulated loss events">
        {feed.map((row) => (
          <li key={row.id} className="mk-loss-feed__row cp-fade-in">
            <span className="mk-loss-feed__time">{ageLabel((tick - row.bornTick) * STEP_S)}</span>
            <span className="mk-loss-feed__addr">{row.addr}</span>
            <span className="mk-loss-tag">{FEED_TYPE_LABELS[row.type]}</span>
            <span className="mk-loss-feed__amount">{`−${row.amount}`}</span>
            <span className="mk-loss-uncovered">Uncovered</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --- Section -------------------------------------------------------------- */

/** "Real money lost" — loss-awareness section, inserted right after Problem. */
export function Losses(): JSX.Element {
  return (
    <section id="losses" className="mk-section" aria-labelledby="losses-title">
      <div className="mk-container">
        <Reveal>
          <p className="mk-eyebrow">{LOSSES.eyebrow}</p>
          <h2 id="losses-title" className="mk-section__title">
            {LOSSES.title}
          </h2>
          <p className="mk-section__lead">{LOSSES.lead}</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mk-loss-band">
            {MARKET_STATS.map((stat) => (
              <LossStat key={stat.label} stat={stat} />
            ))}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <p className="mk-loss-incidents-label">{LOSSES.incidentsLabel}</p>
          <div
            className="cp-marquee mk-loss-marquee"
            role="group"
            aria-label="Real, cited DeFi exploit incidents"
          >
            <div className="cp-marquee__track">
              {INCIDENTS.map((incident) => (
                <IncidentCard key={incident.name} incident={incident} />
              ))}
              {INCIDENTS.map((incident) => (
                <IncidentCard key={`dup-${incident.name}`} incident={incident} duplicate />
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <LiveFeed />
        </Reveal>
      </div>
    </section>
  );
}
