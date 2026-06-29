/**
 * "Real money lost" — cited DeFi/agent loss data as typed, static content.
 *
 * Every figure here is a *real, publicly reported* incident with an explicit
 * citation; nothing is fabricated and nothing is presented as Casper Network
 * activity. The numbers underline CasperProof's thesis: unverifiable inputs
 * (oracle prints, bridge signatures, agent decisions) keep draining DeFi, and
 * the agent economy inherits exactly that risk.
 *
 * The only synthetic data on the page is the clearly-labelled "uncovered agent
 * losses" feed in `components/Losses.tsx`, which is generated client-side and
 * marked as an illustrative simulation — never sourced from here.
 */

/** A citation for a loss figure. `url` is omitted when only a named primary source exists. */
export interface LossSource {
  /** Human-readable source name (e.g. "Chainalysis"). */
  name: string;
  /** Canonical URL for the report, when one is publicly linkable. */
  url?: string;
}

/** What kind of failure caused the loss — maps to CasperProof's coverage triggers. */
export type LossCategory = 'oracle' | 'bridge' | 'flash-loan' | 'agent';

/** A single real, cited loss incident. */
export interface LossIncident {
  /** Protocol / target name. */
  name: string;
  /** Pre-formatted loss amount as reported (e.g. "$117M"). */
  amount: string;
  /** When it happened (e.g. "Oct 2022"). */
  date: string;
  /** One-line root cause. */
  cause: string;
  /** Failure category. */
  category: LossCategory;
  /** Where the figure is cited. */
  source: LossSource;
}

/** A headline market statistic (drives the count-up stat band). */
export interface MarketStat {
  /** Short metric label. */
  label: string;
  /** Canonical, pre-formatted value (e.g. "$2.2B") — the source of truth, used for screen readers + no-JS. */
  value: string;
  /** Count-up prefix (e.g. "$", "~$"). */
  prefix: string;
  /** Numeric target the count-up animates to, in the unit implied by `suffix`. */
  to: number;
  /** Count-up suffix / unit (e.g. "B", "M+"). */
  suffix: string;
  /** Decimal places shown while counting up. */
  decimals: number;
  /** Supporting context. */
  note: string;
  /** Citation. */
  source: LossSource;
}

/** Human labels for each failure category. */
export const CATEGORY_LABELS: Record<LossCategory, string> = {
  oracle: 'Oracle manipulation',
  bridge: 'Bridge / verification',
  'flash-loan': 'Flash-loan',
  agent: 'Agent failure',
};

// --- Shared citations ------------------------------------------------------

/** Chainalysis crypto-hacking / stolen-funds report. */
const CHAINALYSIS_HACKING: LossSource = {
  name: 'Chainalysis',
  url: 'https://www.chainalysis.com/blog/crypto-hacking-stolen-funds-2025/',
};

/** Chainalysis oracle-manipulation deep-dive. */
const CHAINALYSIS_ORACLE: LossSource = {
  name: 'Chainalysis',
  url: 'https://www.chainalysis.com/blog/oracle-manipulation-attacks-rising/',
};

/** Hacken incident analysis of the BonqDAO exploit. */
const HACKEN_BONQ: LossSource = {
  name: 'Hacken',
  url: 'https://hacken.io/insights/bonqdao-hack/',
};

// --- Incidents -------------------------------------------------------------

/**
 * Real, cited loss incidents. Oracle-manipulation cases lead because they are
 * CasperProof's core thesis, but the set spans bridges, flash-loans, and the
 * first notable autonomous-agent loss too.
 */
export const INCIDENTS: LossIncident[] = [
  {
    name: 'Mango Markets',
    amount: '$117M',
    date: 'Oct 2022',
    cause: 'Oracle price manipulation drained the perp DEX.',
    category: 'oracle',
    source: CHAINALYSIS_ORACLE,
  },
  {
    name: 'BonqDAO',
    amount: '$120M',
    date: 'Feb 2023',
    cause: 'Tellor price-oracle manipulation.',
    category: 'oracle',
    source: HACKEN_BONQ,
  },
  {
    name: 'Cream Finance',
    amount: '$130M',
    date: 'Oct 2021',
    cause: 'Oracle + flash-loan price manipulation.',
    category: 'oracle',
    source: CHAINALYSIS_ORACLE,
  },
  {
    name: 'Wormhole',
    amount: '$326M',
    date: 'Feb 2022',
    cause: 'Forged signature / verification bypass on the bridge.',
    category: 'bridge',
    source: CHAINALYSIS_HACKING,
  },
  {
    name: 'Euler Finance',
    amount: '$197M',
    date: 'Mar 2023',
    cause: 'Flash-loan donation attack (most later returned).',
    category: 'flash-loan',
    source: CHAINALYSIS_HACKING,
  },
  {
    name: 'Freysa',
    amount: '$47K',
    date: 'Nov 2024',
    cause: 'AI agent talked into releasing funds via prompt injection.',
    category: 'agent',
    source: { name: 'Freysa challenge (on-chain, Base)' },
  },
];

// --- Market stats (count-up band) -----------------------------------------

/** Headline figures for the stat band — all attributed to Chainalysis. */
export const MARKET_STATS: MarketStat[] = [
  {
    label: 'Stolen in 2024',
    value: '$2.2B',
    prefix: '$',
    to: 2.2,
    suffix: 'B',
    decimals: 1,
    note: 'Across 303 distinct hacking incidents.',
    source: CHAINALYSIS_HACKING,
  },
  {
    label: 'Stolen in 2025',
    value: '~$3.4B',
    prefix: '~$',
    to: 3.4,
    suffix: 'B',
    decimals: 1,
    note: 'Reported stolen across the ecosystem.',
    source: CHAINALYSIS_HACKING,
  },
  {
    label: 'Lost to oracle manipulation',
    value: '$200M+',
    prefix: '$',
    to: 200,
    suffix: 'M+',
    decimals: 0,
    note: 'Drained via price-oracle manipulation alone.',
    source: CHAINALYSIS_ORACLE,
  },
  {
    label: 'Hacking incidents in 2024',
    value: '303',
    prefix: '',
    to: 303,
    suffix: '',
    decimals: 0,
    note: 'Distinct incidents tracked in a single year.',
    source: CHAINALYSIS_HACKING,
  },
];
