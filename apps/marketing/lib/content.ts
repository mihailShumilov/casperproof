/**
 * Static marketing copy as typed data.
 *
 * Keeping section content here (instead of inline JSX) makes it testable and
 * keeps the page components thin. None of this is a metric — live numbers come
 * from the SDK (`lib/stats.ts`); everything here is product narrative.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface HowItWorksStep {
  step: number;
  title: string;
  body: string;
}

export interface UseCase {
  tag: string;
  title: string;
  body: string;
}

export interface RoadmapItem {
  phase: string;
  status: 'shipped' | 'in-progress' | 'planned';
  title: string;
  body: string;
}

export interface BuilderFeature {
  title: string;
  body: string;
  code: string;
  language: string;
}

export interface TeamLink {
  label: string;
  href: string;
}

/** In-page anchor navigation. */
export const NAV_LINKS: NavLink[] = [
  { label: 'Problem', href: '#problem' },
  { label: 'Losses', href: '#losses' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Live numbers', href: '#live-numbers' },
  { label: 'For builders', href: '#builders' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Roadmap', href: '#roadmap' },
];

/** "The problem" — two framed pain points. */
export const PROBLEMS: { title: string; body: string }[] = [
  {
    title: 'Agent outputs are unverifiable',
    body: 'Autonomous agents produce prices, risk scores, and decisions that downstream systems must trust blindly. There is no on-chain proof that an output is what the model actually produced — or that it has not been tampered with after the fact.',
  },
  {
    title: 'Agent capital is uninsured',
    body: 'When an agent is wrong — a bad oracle print, an exploited integration, a governance attack — the loss lands on whoever depended on it. There is no native way to price that risk or pay out automatically when it materializes.',
  },
];

/** "Real money lost" — honest framing copy for the losses section. */
export const LOSSES = {
  eyebrow: 'Real money lost',
  title: "Unverifiable inputs cost DeFi billions — Casper's agent economy is next.",
  lead: "Every exploit below trusted an input it couldn't prove. CasperProof makes agent outputs provable and insurable on Casper, before the loss.",
  incidentsLabel: 'Cited, real incidents — auto-scrolling; pauses on hover or focus.',
  feedTitle: 'Uncovered agent losses',
  feedNote:
    'Illustrative simulation: synthetic events generated on an interval to picture an unprotected agent economy. These are not real Casper Network transactions.',
} as const;

/** "How it works" — three steps. */
export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    step: 1,
    title: 'Attest',
    body: 'An agent commits to its output by staking CSPR and writing a blake2b commitment of (model, input, output, timestamp) to the on-chain AttestationRegistry. The stake is collateral against fraud.',
  },
  {
    step: 2,
    title: 'Pay & verify',
    body: 'Consumers pay per call over x402 and verify any attestation: recompute the output hash and compare it byte-for-byte to the on-chain commitment. PASS or FAIL — no trust required.',
  },
  {
    step: 3,
    title: 'Challenge & slash',
    body: 'Anyone can challenge a suspect attestation with a dispute bond. A resolver adjudicates; fraudulent attestors are slashed and the challenger is rewarded. Honest agents build reputation.',
  },
];

/** "For builders" — SDK, MCP, x402. */
export const BUILDER_FEATURES: BuilderFeature[] = [
  {
    title: 'One-liner SDK',
    body: 'Attest, verify, challenge, and resolve through a single typed client. Runs against an in-memory mock with zero secrets, or live over CSPR.cloud when a token is present.',
    language: 'ts',
    code: `import { createClient } from '@casperproof/casper-sdk';

const cp = createClient(); // mock unless CSPR_CLOUD_TOKEN is set
const { id } = await cp.submitAttestation({
  modelId: 'riskscorer-v1',
  input: { address: 'account-hash-aabbcc' },
  output: { score: 73, tier: 'HIGH' },
  uri: 's3://payloads/abc.json',
  stake: '2000000000',
});

const { valid } = await cp.verify(id, { score: 73, tier: 'HIGH' });`,
  },
  {
    title: 'MCP tools',
    body: 'Drop CasperProof into any MCP-aware agent. The server exposes attest / verify / challenge as first-class tools so agents can prove and check each other autonomously.',
    language: 'json',
    code: `{
  "mcpServers": {
    "casperproof": {
      "command": "casperproof-mcp",
      "tools": ["attest", "verify", "challenge", "score_risk"]
    }
  }
}`,
  },
  {
    title: 'x402 pay-per-call',
    body: 'Monetize verifiable inference natively. Each verify or attest call settles over the x402 HTTP payment protocol — pay exactly for what you use, no API keys or invoices.',
    language: 'http',
    code: `GET /verify/42 HTTP/1.1
Host: api.casperproof.com

HTTP/1.1 402 Payment Required
Accept-Payment: x402 token=CSPR; amount=10000000
Link: <https://casperproof.com/x402>; rel="payment"`,
  },
];

/** "Use cases". */
export const USE_CASES: UseCase[] = [
  {
    tag: 'RWA',
    title: 'RWA price oracle',
    body: 'Anchor real-world-asset valuations with stake-backed attestations. Buyers verify the print on-chain before settling; bad prints are challengeable and slashable.',
  },
  {
    tag: 'DeFi',
    title: 'DeFi agent insurance',
    body: 'Parametric cover for autonomous strategies. Buy a policy, and when a covered trigger (exploit, oracle failure, agent error) is attested, the claim pays out automatically.',
  },
  {
    tag: 'Compliance',
    title: 'Compliance & audit trail',
    body: 'Every model decision leaves an immutable, content-addressed proof. Regulators and auditors verify what was produced, by which model, and when — without trusting the operator.',
  },
];

/** "Roadmap". */
export const ROADMAP: RoadmapItem[] = [
  {
    phase: 'Phase 1',
    status: 'shipped',
    title: 'Verifiable oracle on testnet',
    body: 'AttestationRegistry + commitment scheme, SDK, MCP server, and the verify/challenge/slash flow live on Casper testnet.',
  },
  {
    phase: 'Phase 2',
    status: 'in-progress',
    title: 'Parametric insurance vault',
    body: 'Risk scoring, policy creation, and automatic claim payout backed by a solvency-checked vault.',
  },
  {
    phase: 'Phase 3',
    status: 'planned',
    title: 'Mainnet & open resolver set',
    body: 'Mainnet deployment, decentralized challenge resolution, and reputation-weighted staking markets.',
  },
];

/** "Team + socials" links. */
export const TEAM_LINKS: TeamLink[] = [
  { label: 'X / Twitter', href: 'https://twitter.com/casperproof' },
  { label: 'GitHub', href: 'https://github.com/casperproof' },
];

/** Footer attribution lines. */
export const FOOTER = {
  buildathon: 'Built for the Casper buildathon.',
  attribution: 'Powered by the Casper Network.',
} as const;
