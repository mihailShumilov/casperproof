import { Button, Badge, Tag } from './ui';
import { APP_URL, CSPR_FANS_URL } from '../lib/site';

/**
 * Hero: tagline + two CTAs.
 *  - "Launch app" → the dApp (`NEXT_PUBLIC_APP_URL`).
 *  - "Vote on CSPR.fans" → the community-vote listing.
 */
export function Hero(): JSX.Element {
  return (
    <section className="mk-hero" aria-labelledby="hero-title">
      <div className="mk-container mk-hero__inner">
        <Badge status="pass" dot>
          Verifiable AI oracle on Casper
        </Badge>
        <h1 id="hero-title" className="mk-hero__title">
          Proof your agents <span className="mk-hero__accent">can&rsquo;t fake.</span>
        </h1>
        <p className="mk-hero__sub">Stake-backed truth for autonomous agents.</p>
        <div className="mk-cta-row">
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="primary">
              Launch app
            </Button>
          </a>
          <a href={CSPR_FANS_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="secondary">
              Vote on CSPR.fans
            </Button>
          </a>
        </div>
        <div className="mk-hero__meta">
          <Tag>On-chain attestations</Tag>
          <Tag>x402 pay-per-call</Tag>
          <Tag>Parametric insurance</Tag>
          <Tag>MCP-native</Tag>
        </div>
      </div>
    </section>
  );
}
