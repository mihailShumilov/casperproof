import { StatTile, Badge } from './ui';
import type { LiveStats } from '../lib/stats';

/**
 * "Live numbers" — real stats read from `@casperproof/casper-sdk`.
 *
 * The provenance is shown explicitly: in `mock` mode the section is labelled as
 * a seeded demo source (no real testnet activity is implied); in `live` mode it
 * reflects CSPR.cloud testnet reads. No metric here is hard-coded.
 */
export function LiveNumbers({ data }: { data: LiveStats }): JSX.Element {
  const isLive = data.mode === 'live';
  return (
    <section id="live-numbers" className="mk-section" aria-labelledby="live-title">
      <div className="mk-container">
        <p className="mk-eyebrow">Live numbers</p>
        <h2 id="live-title" className="mk-section__title">
          Read straight from the SDK.
        </h2>
        <p className="mk-section__lead">
          These tiles are populated by <code>@casperproof/casper-sdk</code> at build time — not
          typed in by hand.
        </p>
        <div className="mk-grid mk-grid--4">
          {data.stats.map((stat) => (
            <StatTile key={stat.key} label={stat.label} value={stat.value} delta={stat.hint} />
          ))}
        </div>
        <p className="mk-source-note">
          <Badge status={isLive ? 'pass' : 'finalized'} dot>
            {isLive ? 'Live · CSPR.cloud' : 'Mock source'}
          </Badge>
          {isLive
            ? 'Sourced live from Casper testnet via CSPR.cloud.'
            : 'No CSPR_CLOUD_TOKEN set — figures come from the SDK mock backend (a seeded demo flow), not real testnet activity.'}
        </p>
      </div>
    </section>
  );
}
