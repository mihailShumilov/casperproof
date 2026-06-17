import type { Metadata } from 'next';
import { InsuranceView } from './InsuranceView';

export const metadata: Metadata = {
  title: 'Insurance',
  description:
    'Score an address, buy a parametric policy, then simulate a covered trigger and watch the vault pay out automatically.',
};

export default function InsurancePage(): JSX.Element {
  return <InsuranceView />;
}
