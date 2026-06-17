import type { Metadata, Viewport } from 'next';
import '@casperproof/ui/styles.css';
import './globals.css';
import { BRAND, SITE_URL, SOCIALS, absoluteUrl } from '../lib/site';

/**
 * Root layout for the static-exported marketing site.
 *
 * Declares the complete SEO/OG/Twitter metadata. All absolute URLs resolve to
 * the production origin (`NEXT_PUBLIC_SITE_URL`, default https://casperproof.com)
 * so social unfurls never point at localhost. The OG image is a static SVG in
 * `public/`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [
    'Casper',
    'verifiable AI',
    'AI oracle',
    'agent economy',
    'parametric insurance',
    'attestation',
    'x402',
    'MCP',
    'blockchain oracle',
    'stake-backed',
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    url: SITE_URL,
    images: [
      {
        url: absoluteUrl('/og.svg'),
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — ${BRAND.tagline}`,
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: SOCIALS.twitterHandle,
    creator: SOCIALS.twitterHandle,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: [absoluteUrl('/og.svg')],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/favicon.svg',
  },
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: '#0a0b0e',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <a className="mk-skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
