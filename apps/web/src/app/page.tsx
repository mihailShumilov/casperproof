/**
 * Home — a compact landing for the dApp. Frames the product, links into the
 * three demo views, and shows the live event feed so the chain is visible from
 * the first screen.
 */
import Link from 'next/link';
import { Button, Card, Tag } from '@/components/ui';
import { LiveFeed } from '@/components/LiveFeed';

export default function HomePage(): JSX.Element {
  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <section className="hero">
        <Tag>Verifiable AI oracle · Casper</Tag>
        <h1>
          Proof your agents <span className="accent">can&apos;t fake.</span>
        </h1>
        <p>
          CasperProof anchors every AI decision as a stake-backed, tamper-evident attestation on
          Casper. Anyone can verify a proof; bad proofs get slashed. Parametric insurance pays out
          automatically when an attested trigger fires.
        </p>
        <div className="row">
          <Link href="/attest">
            <Button variant="primary" size="lg">
              Run risk assessment
            </Button>
          </Link>
          <Link href="/oracle">
            <Button variant="secondary" size="lg">
              Open the oracle
            </Button>
          </Link>
          <Link href="/insurance">
            <Button variant="ghost" size="lg">
              Insurance
            </Button>
          </Link>
          <Link href="/staking">
            <Button variant="ghost" size="lg">
              Stake
            </Button>
          </Link>
          <Link href="/slash">
            <Button variant="ghost" size="lg">
              Slash demo
            </Button>
          </Link>
        </div>
      </section>

      <section>
        <Link href="/attest" className="home-feature" aria-label="Run the risk assessment">
          <Card interactive>
            <Tag>Headline experience</Tag>
            <h2 className="section-title" style={{ marginTop: 'var(--cp-space-md)' }}>
              Score an agent across 15 on-chain factors
            </h2>
            <p className="muted">
              Watch the model collect on-chain data, step through the 15 weighted risk factors, and
              resolve to a percentage score and tier — then share the result. Read-only; no wallet
              required.
            </p>
            <span className="home-feature__cta">Run risk assessment →</span>
          </Card>
        </Link>
      </section>

      <section className="grid grid--3">
        <Card>
          <h2 className="section-title">1 · Attest</h2>
          <p className="muted">
            An agent publishes a blake2b-256 commitment of its input/output, stake locked behind it.
            The chain stores hashes only.
          </p>
        </Card>
        <Card>
          <h2 className="section-title">2 · Verify</h2>
          <p className="muted">
            Anyone recomputes the hash from the payload and compares it byte-for-byte to the
            on-chain commitment. Match = PASS, tamper = FAIL.
          </p>
        </Card>
        <Card>
          <h2 className="section-title">3 · Slash</h2>
          <p className="muted">
            Challenge a bad proof, resolve it fraudulent, and the stake is split between the
            challenger and treasury.
          </p>
        </Card>
      </section>

      <section>
        <Link href="/staking" className="home-feature" aria-label="Stake into the insurance vault">
          <Card interactive>
            <Tag>Be the house</Tag>
            <h2 className="section-title" style={{ marginTop: 'var(--cp-space-md)' }}>
              Stake CSPR behind the vault and earn the premiums
            </h2>
            <p className="muted">
              Supply capital to the LP pool that collateralises outstanding coverage and take a
              pro-rata cut of every premium. Withdrawals clear an on-chain solvency guard — no timed
              cooldown — so capital can never walk out from under live policies.
            </p>
            <span className="home-feature__cta">Open staking →</span>
          </Card>
        </Link>
      </section>

      <section>
        <LiveFeed />
      </section>
    </div>
  );
}
