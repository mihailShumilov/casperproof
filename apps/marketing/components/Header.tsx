import { Button } from './ui';
import { NAV_LINKS } from '../lib/content';
import { APP_URL } from '../lib/site';

/** Sticky site header: brand, in-page nav, and the primary "Launch app" CTA. */
export function Header(): JSX.Element {
  return (
    <header className="mk-header">
      <div className="mk-container mk-header__inner">
        <a className="mk-brand" href="#main" aria-label="CasperProof home">
          <span className="mk-brand__mark" aria-hidden="true">
            ◆
          </span>
          CasperProof
        </a>
        <nav className="mk-nav" aria-label="Primary">
          <ul className="mk-nav__links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a className="mk-nav__link" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="primary">
              Launch app
            </Button>
          </a>
        </nav>
      </div>
    </header>
  );
}
