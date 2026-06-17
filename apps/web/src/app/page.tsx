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
          <Link href="/oracle">
            <Button variant="primary" size="lg">
              Open the oracle
            </Button>
          </Link>
          <Link href="/insurance">
            <Button variant="secondary" size="lg">
              Insurance
            </Button>
          </Link>
          <Link href="/slash">
            <Button variant="ghost" size="lg">
              Slash demo
            </Button>
          </Link>
        </div>
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
        <LiveFeed />
      </section>
    </div>
  );
}
