import type { Metadata } from 'next';
import { OracleView } from './OracleView';

export const metadata: Metadata = {
  title: 'Oracle',
  description:
    'Submit stake-backed AI attestations and verify them against the on-chain commitment — PASS / FAIL with both hashes.',
};

export default function OraclePage(): JSX.Element {
  return <OracleView />;
}
