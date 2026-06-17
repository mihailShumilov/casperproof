/**
 * Root layout for the CasperProof dApp.
 *
 * Imports the shared UI stylesheet (tokens + component classes) and the app
 * chrome styles, wraps the tree in the design-system `ThemeProvider` and the
 * mock `WalletProvider`, and renders the persistent nav + footer. No
 * `next/font/google` — the `--cp-font-*` token stacks fall back to system
 * fonts so the build is fully offline.
 */
import type { Metadata, Viewport } from 'next';
import '@casperproof/ui/styles.css';
import './globals.css';
import { ThemeProvider } from '@/components/ui';
import { WalletProvider } from '@/lib/wallet';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  metadataBase: new URL('https://app.casperproof.com'),
  title: {
    default: 'CasperProof — Verifiable AI Oracle',
    template: '%s · CasperProof',
  },
  description:
    'CasperProof is the verifiable AI oracle and parametric insurance layer on Casper. Proof your agents can\'t fake.',
  applicationName: 'CasperProof',
  keywords: [
    'Casper',
    'verifiable AI',
    'oracle',
    'attestation',
    'parametric insurance',
    'blockchain',
    'agent economy',
  ],
  openGraph: {
    type: 'website',
    siteName: 'CasperProof',
    title: 'CasperProof — Verifiable AI Oracle',
    description: 'Proof your agents can\'t fake. Verifiable AI oracle + parametric insurance on Casper.',
    url: 'https://app.casperproof.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CasperProof — Verifiable AI Oracle',
    description: 'Proof your agents can\'t fake.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0b0e',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <WalletProvider>
            <div className="app-shell">
              <Nav />
              <main className="app-main">{children}</main>
              <footer className="app-footer">
                <p>
                  CasperProof · built for the Casper buildathon · verifiable AI oracle on the
                  Casper Network. Running in <strong>mock mode</strong> — fully offline, no
                  secrets.
                </p>
              </footer>
            </div>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
