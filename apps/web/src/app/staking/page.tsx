import type { Metadata } from 'next';
import { StakingView } from './StakingView';

export const metadata: Metadata = {
  title: 'Staking',
  description:
    'Stake CSPR into the insurance LP pool that backs the oracle’s parametric coverage, earn a share of premiums, and withdraw through an on-chain solvency guard.',
};

export default function StakingPage(): JSX.Element {
  return <StakingView />;
}
