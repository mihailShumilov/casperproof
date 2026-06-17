/**
 * RFC 7807 `application/problem+json` responses, mirroring the Rust `contracts/problem`
 * (`CasperProofError`) taxonomy so every CasperProof HTTP surface returns the same shape.
 */
export const APPLICATION_PROBLEM_JSON = 'application/problem+json';
const PROBLEM_BASE = 'https://casperproof.com/problems/';

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

function problem(
  slug: string,
  code: string,
  status: number,
  title: string,
  extra: Record<string, unknown> = {},
): Problem {
  return { type: `${PROBLEM_BASE}${slug}`, title, status, code, ...extra };
}

export function paymentRequired(priceUsd: string, payTo: string, instance: string): Problem {
  return problem('payment-required', 'PAYMENT_REQUIRED', 402, 'Payment required', {
    detail: `This resource is x402-gated. Pay ${priceUsd} USD to \`${payTo}\` then retry with an X-PAYMENT header.`,
    instance,
    price_usd: priceUsd,
    pay_to: payTo,
  });
}

export function attestationNotFound(id: number): Problem {
  return problem('attestation-not-found', 'ATTESTATION_NOT_FOUND', 404, 'Attestation not found', {
    detail: `No attestation exists with id ${id}.`,
    attestation_id: id,
  });
}

export function payloadUnavailable(uri: string): Problem {
  return problem('payload-unavailable', 'PAYLOAD_UNAVAILABLE', 502, 'Payload unavailable', {
    detail: 'The off-chain payload could not be fetched from the object store.',
    uri,
  });
}

export function badRequest(detail: string): Problem {
  return problem('bad-request', 'BAD_REQUEST', 400, 'Bad request', { detail });
}

export function internalError(): Problem {
  return problem('internal-error', 'INTERNAL_ERROR', 500, 'Internal error', {
    detail: 'An unexpected error occurred.',
  });
}
