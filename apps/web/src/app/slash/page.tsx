import type { Metadata } from 'next';
import { SlashView } from './SlashView';

export const metadata: Metadata = {
  title: 'Slash demo',
  description:
    'Tamper a payload, watch verification FAIL, challenge the attestation, resolve it fraudulent, and slash the stake.',
};

export default function SlashPage(): JSX.Element {
  return <SlashView />;
}
