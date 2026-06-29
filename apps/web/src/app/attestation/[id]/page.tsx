import type { Metadata } from 'next';
import { decodeSeed } from '@/lib/riskFactors';
import { formatHash } from '@/lib/format';
import { AttestationResult } from './AttestationResult';

interface PageProps {
  params: { id: string };
}

/** Per-result OpenGraph / Twitter metadata. The id deterministically encodes
 *  the assessed seed, so the title/description are stable per shared link. */
export function generateMetadata({ params }: PageProps): Metadata {
  let label = 'agent';
  try {
    const seed = decodeSeed(params.id);
    if (seed.length > 0) label = formatHash(seed, 14, 6);
  } catch {
    /* fall back to the generic label */
  }
  const title = `Risk assessment · ${label}`;
  const description = `CasperProof's 15-factor risk assessment for ${label} — a stake-backed, verifiable score on Casper.`;
  const url = `/attestation/${params.id}`;
  const image = '/og-attestation.svg';

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: 'CasperProof risk assessment' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function AttestationResultPage({ params }: PageProps): JSX.Element {
  return <AttestationResult id={params.id} />;
}
