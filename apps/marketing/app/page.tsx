import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Problem } from '../components/Problem';
import { HowItWorks } from '../components/HowItWorks';
import { LiveNumbers } from '../components/LiveNumbers';
import { Builders } from '../components/Builders';
import { UseCases } from '../components/UseCases';
import { Roadmap } from '../components/Roadmap';
import { Footer } from '../components/Footer';
import { getLiveStats } from '../lib/stats';
import { BRAND, SITE_URL, SOCIALS } from '../lib/site';

/**
 * The single marketing page. A Server Component: the live-numbers snapshot is
 * resolved from the SDK at build time (static export), so the produced HTML
 * already contains the figures — no client fetch, no hydration cost.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const stats = await getLiveStats();

  // JSON-LD structured data for richer search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: BRAND.description,
    url: SITE_URL,
    sameAs: [SOCIALS.twitter, SOCIALS.github],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data must be serialized into the document.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <LiveNumbers data={stats} />
        <Builders />
        <UseCases />
        <Roadmap />
      </main>
      <Footer />
    </>
  );
}
