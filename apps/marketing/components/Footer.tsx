import { Button } from './ui';
import { TEAM_LINKS, FOOTER } from '../lib/content';
import { APP_URL, CSPR_FANS_URL, SOCIALS, BRAND } from '../lib/site';

/**
 * Footer: team + socials, the two CTAs again, and the required buildathon +
 * Casper attribution.
 */
export function Footer(): JSX.Element {
  const year = new Date().getFullYear();
  return (
    <footer className="mk-footer" aria-labelledby="footer-title">
      <div className="mk-container">
        <h2 id="footer-title" className="cp-sr-only">
          Site footer
        </h2>
        <div className="mk-footer__inner">
          <div style={{ maxWidth: '24rem' }}>
            <span className="mk-brand" aria-hidden="true">
              <span className="mk-brand__mark">◆</span>
              CasperProof
            </span>
            <p style={{ marginTop: 'var(--cp-space-md)' }}>{BRAND.subTagline}</p>
            <div className="mk-cta-row" style={{ marginTop: 'var(--cp-space-lg)' }}>
              <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="primary">
                  Launch app
                </Button>
              </a>
              <a href={CSPR_FANS_URL} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary">
                  Vote on CSPR.fans
                </Button>
              </a>
            </div>
          </div>
          <nav aria-label="Team and socials">
            <p className="mk-eyebrow">Team &amp; socials</p>
            <ul className="mk-footer__links" style={{ flexDirection: 'column', gap: 'var(--cp-space-sm)' }}>
              {TEAM_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    className="mk-footer__link"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  className="mk-footer__link"
                  href={SOCIALS.casper}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Casper Network
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mk-footer__legal">
          © {year} {BRAND.name}. {FOOTER.buildathon} {FOOTER.attribution}
        </p>
      </div>
    </footer>
  );
}
