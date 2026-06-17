/**
 * Persistent top navigation for the dApp. Highlights the active route and hosts
 * the wallet connect button.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './WalletButton';

const LINKS: { href: string; label: string }[] = [
  { href: '/oracle', label: 'Oracle' },
  { href: '/insurance', label: 'Insurance' },
  { href: '/slash', label: 'Slash demo' },
];

export function Nav(): JSX.Element {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href === '/oracle' && pathname === '/');

  return (
    <nav className="app-nav" aria-label="Primary">
      <Link href="/" className="app-brand">
        <span className="app-brand__mark" aria-hidden="true">
          ◆
        </span>
        <span>
          CasperProof
          <span className="app-brand__tag"> · Proof your agents can&apos;t fake.</span>
        </span>
      </Link>
      <div className="app-navlinks">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="app-navlink"
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="app-nav__spacer" />
      <WalletButton />
    </nav>
  );
}
