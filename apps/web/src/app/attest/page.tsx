import type { Metadata } from 'next';
import { AttestView } from './AttestView';

export const metadata: Metadata = {
  title: 'Risk assessment',
  description:
    'Run the CasperProof risk assessment across 15 on-chain factors and produce a shareable, stake-backed percentage result.',
};

export default function AttestPage(): JSX.Element {
  return <AttestView />;
}
