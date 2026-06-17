/**
 * Site-wide configuration resolved from public environment variables.
 *
 * These are read at build time (static export) from `NEXT_PUBLIC_*` vars with
 * documented production defaults. Keeping them in one typed module means OG
 * tags, canonical URLs, and CTAs never hard-code a localhost value.
 */

/** Read a `NEXT_PUBLIC_*` env var, falling back to a default. */
function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

/** Strip a single trailing slash so URL joins are predictable. */
export function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/** Production marketing-site origin (used for canonical + OG absolute URLs). */
export const SITE_URL = stripTrailingSlash(
  env('NEXT_PUBLIC_SITE_URL', 'https://casperproof.com'),
);

/** The dApp the "Launch app" CTA points to. */
export const APP_URL = stripTrailingSlash(
  env('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
);

/**
 * The CSPR.fans community-vote listing.
 *
 * SETUP_NEEDED: replace the default with the real CSPR.fans project URL once
 * the listing is live (set `NEXT_PUBLIC_CSPR_FANS_URL`).
 */
export const CSPR_FANS_URL = env('NEXT_PUBLIC_CSPR_FANS_URL', 'https://cspr.fans');

/** Brand strings. */
export const BRAND = {
  name: 'CasperProof',
  tagline: "Proof your agents can't fake.",
  subTagline: 'Stake-backed truth for autonomous agents.',
  description:
    'CasperProof is the verifiable AI oracle and parametric-insurance trust layer for the agent economy on Casper. Agents stake to attest; anyone can verify or challenge, and fraud is slashed on-chain.',
} as const;

/** Outbound social + project links. */
export const SOCIALS = {
  twitter: 'https://twitter.com/casperproof',
  twitterHandle: '@casperproof',
  github: 'https://github.com/casperproof',
  casper: 'https://casper.network',
} as const;

/** Absolute URL helper for the production origin. */
export function absoluteUrl(path = ''): string {
  if (!path) return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
