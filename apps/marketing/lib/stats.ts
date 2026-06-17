/**
 * Live numbers, sourced from `@casperproof/casper-sdk`.
 *
 * This module never fabricates metrics. It creates a real SDK client and reads
 * its state through the public API. In **mock mode** (no `CSPR_CLOUD_TOKEN`) the
 * SDK's in-memory store starts empty, so we drive a small, deterministic demo
 * flow through the *same* client methods an agent would call — submit a few
 * attestations, resolve some to accrue reputation, open a policy — and then
 * report whatever the SDK computes. The values are therefore genuine SDK
 * output, and the UI labels the source as a mock so nothing is presented as
 * real testnet activity.
 *
 * In **live mode** the client reads CSPR.cloud and the numbers are real testnet
 * stats; we do not seed in that case.
 */
import { createClient } from '@casperproof/casper-sdk';
import type { CasperProofSdk } from '@casperproof/casper-sdk';

/** A single live-number tile. */
export interface LiveStat {
  key: string;
  label: string;
  value: string;
  hint: string;
}

/** The resolved live-numbers snapshot plus its provenance. */
export interface LiveStats {
  /** `mock` (seeded demo flow) or `live` (real CSPR.cloud testnet reads). */
  mode: 'mock' | 'live';
  /** Tiles to render. */
  stats: LiveStat[];
  /** Unix-seconds timestamp the snapshot was taken. */
  generatedAt: number;
}

/** Minimum stake the demo flow locks per attestation (motes ≥ registry min). */
const DEMO_STAKE = '2000000000';

/**
 * Seed a deterministic demo flow against a mock client so the live-numbers
 * section has something truthful to show. Every value below is produced by the
 * SDK in response to these calls — none are hard-coded metrics.
 */
async function seedMockFlow(cp: CasperProofSdk): Promise<void> {
  const attestors = [
    'account-hash-1111111111111111111111111111111111111111111111111111111111111111',
    'account-hash-2222222222222222222222222222222222222222222222222222222222222222',
    'account-hash-3333333333333333333333333333333333333333333333333333333333333333',
  ];

  // Submit a handful of attestations across attestors.
  const ids: { id: number; attestor: string }[] = [];
  for (let i = 0; i < 9; i += 1) {
    const attestor = attestors[i % attestors.length] as string;
    const { id } = await cp.submitAttestation({
      modelId: 'casperproof-riskscorer-v1',
      input: { address: attestor, nonce: i },
      output: { score: 40 + i * 5, tier: i % 3 === 0 ? 'HIGH' : 'MEDIUM' },
      timestamp: 1_700_000_000 + i,
      uri: `s3://casperproof-payloads/demo-${i}.json`,
      stake: DEMO_STAKE,
      // Attribute to a known attestor so reputation can be aggregated below.
      attestor,
    });
    ids.push({ id, attestor });
  }

  // Challenge two; resolve one honestly (reputation +) and one as fraud (slash).
  await cp.challenge(ids[1]!.id);
  await cp.resolve(ids[1]!.id, false); // defended honestly
  await cp.challenge(ids[4]!.id);
  await cp.resolve(ids[4]!.id, true); // fraudulent → slashed

  // Open one parametric policy so the count is non-zero.
  await cp.createPolicy({
    coverage: '50000000000',
    premium: '500000000',
    triggerTypes: ['exploit', 'oracle_failure'],
    expiry: 1_900_000_000,
  });
}

/**
 * Build the live-numbers snapshot. Safe to call at build time (static export);
 * never throws — on any error it returns an empty-but-labelled snapshot so the
 * page still renders.
 */
export async function getLiveStats(): Promise<LiveStats> {
  const generatedAt = Math.floor(Date.now() / 1000);
  try {
    const cp = createClient();

    if (cp.mode === 'mock') {
      await seedMockFlow(cp);
    }

    const count = await cp.attestationCount();

    // Aggregate reputation across the demo attestors (mock) — these are SDK
    // reads, not invented figures.
    const attestors = [
      'account-hash-1111111111111111111111111111111111111111111111111111111111111111',
      'account-hash-2222222222222222222222222222222222222222222222222222222222222222',
      'account-hash-3333333333333333333333333333333333333333333333333333333333333333',
    ];
    let successful = 0;
    let slashed = 0;
    for (const a of attestors) {
      const rep = await cp.attestorReputation(a);
      successful += rep.successful;
      slashed += rep.slashed;
    }
    const resolved = successful + slashed;
    const honestRatio = resolved === 0 ? 1 : successful / resolved;

    const stats: LiveStat[] = [
      {
        key: 'attestations',
        label: 'Attestations on registry',
        value: String(count),
        hint: 'Total commitments written to the AttestationRegistry.',
      },
      {
        key: 'resolved',
        label: 'Challenges resolved',
        value: String(resolved),
        hint: 'Disputes adjudicated by a resolver.',
      },
      {
        key: 'slashed',
        label: 'Fraudulent slashes',
        value: String(slashed),
        hint: 'Attestations slashed after a successful challenge.',
      },
      {
        key: 'honest',
        label: 'Honest-resolution rate',
        value: `${Math.round(honestRatio * 100)}%`,
        hint: 'Share of resolved attestations that were upheld as honest.',
      },
    ];

    return { mode: cp.mode, stats, generatedAt };
  } catch {
    // Defensive: a static build should never fail because of stats.
    return {
      mode: 'mock',
      stats: [
        {
          key: 'attestations',
          label: 'Attestations on registry',
          value: '—',
          hint: 'Live source unavailable at build time.',
        },
      ],
      generatedAt,
    };
  }
}
