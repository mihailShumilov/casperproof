/**
 * The CasperProof error taxonomy for the SDK — a TypeScript mirror of the Rust
 * `CasperProofError` (RFC 7807) defined in `contracts/problem/src/lib.rs`. The codes, HTTP
 * statuses, and problem `type` URIs are identical so the on-chain errors, the services, and
 * the SDK never drift.
 *
 * Every recoverable failure surfaces as a thrown {@link CasperProofSdkError} carrying the
 * stable machine-readable {@link CasperProofErrorCode}, the HTTP status, and an optional
 * structured `detail`.
 */

/**
 * Stable, machine-readable error codes shared across the SDK, the contracts, and the HTTP
 * services. One-to-one with the Rust `CasperProofError::code()` values.
 */
export const ERROR_CODES = [
  'ATTESTATION_NOT_FOUND',
  'INSUFFICIENT_STAKE',
  'DISPUTE_WINDOW_CLOSED',
  'ALREADY_CHALLENGED',
  'UNAUTHORIZED',
  'ATTESTATION_NOT_ACTIVE',
  'TAMPERED_PAYLOAD',
  'PAYLOAD_UNAVAILABLE',
  'POLICY_NOT_FOUND',
  'POLICY_EXPIRED',
  'TRIGGER_NOT_COVERED',
  'VAULT_INSOLVENT',
  'PAYMENT_REQUIRED',
  'INTERNAL_ERROR',
] as const;

/** A CasperProof error code (see {@link ERROR_CODES}). */
export type CasperProofErrorCode = (typeof ERROR_CODES)[number];

/** Base URI namespace for every CasperProof problem `type` (mirrors `PROBLEM_BASE` in Rust). */
export const PROBLEM_BASE = 'https://casperproof.com/problems/';

/** Default HTTP status for each error code (mirrors `CasperProofError::status()`). */
const STATUS_BY_CODE: Record<CasperProofErrorCode, number> = {
  ATTESTATION_NOT_FOUND: 404,
  POLICY_NOT_FOUND: 404,
  INSUFFICIENT_STAKE: 422,
  TAMPERED_PAYLOAD: 422,
  TRIGGER_NOT_COVERED: 422,
  DISPUTE_WINDOW_CLOSED: 409,
  ALREADY_CHALLENGED: 409,
  ATTESTATION_NOT_ACTIVE: 409,
  POLICY_EXPIRED: 409,
  VAULT_INSOLVENT: 409,
  UNAUTHORIZED: 403,
  PAYLOAD_UNAVAILABLE: 502,
  PAYMENT_REQUIRED: 402,
  INTERNAL_ERROR: 500,
};

/** URL slug used in the problem `type` URI for each code (mirrors `CasperProofError::slug()`). */
const SLUG_BY_CODE: Record<CasperProofErrorCode, string> = {
  ATTESTATION_NOT_FOUND: 'attestation-not-found',
  INSUFFICIENT_STAKE: 'insufficient-stake',
  DISPUTE_WINDOW_CLOSED: 'dispute-window-closed',
  ALREADY_CHALLENGED: 'already-challenged',
  UNAUTHORIZED: 'unauthorized',
  ATTESTATION_NOT_ACTIVE: 'attestation-not-active',
  TAMPERED_PAYLOAD: 'tampered-payload',
  PAYLOAD_UNAVAILABLE: 'payload-unavailable',
  POLICY_NOT_FOUND: 'policy-not-found',
  POLICY_EXPIRED: 'policy-expired',
  TRIGGER_NOT_COVERED: 'trigger-not-covered',
  VAULT_INSOLVENT: 'vault-insolvent',
  PAYMENT_REQUIRED: 'payment-required',
  INTERNAL_ERROR: 'internal-error',
};

/** Reverse lookup: HTTP status → most appropriate error code (for mapping REST failures). */
const CODE_BY_STATUS: Record<number, CasperProofErrorCode> = {
  402: 'PAYMENT_REQUIRED',
  403: 'UNAUTHORIZED',
  404: 'ATTESTATION_NOT_FOUND',
  409: 'ATTESTATION_NOT_ACTIVE',
  422: 'TAMPERED_PAYLOAD',
  502: 'PAYLOAD_UNAVAILABLE',
};

/** Default HTTP status for the given error code. */
export function statusForCode(code: CasperProofErrorCode): number {
  return STATUS_BY_CODE[code];
}

/** Canonical RFC 7807 problem `type` URI for the given error code. */
export function typeUriForCode(code: CasperProofErrorCode): string {
  return `${PROBLEM_BASE}${SLUG_BY_CODE[code]}`;
}

/** `true` when `value` is a known {@link CasperProofErrorCode}. */
export function isErrorCode(value: unknown): value is CasperProofErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * A typed CasperProof error. Carries the stable {@link CasperProofErrorCode}, the HTTP
 * `status`, a human-readable `message`, and an optional structured `detail` (the RFC 7807
 * extension members from the service, e.g. `attestation_id`, `onchain_hash`).
 */
export class CasperProofSdkError extends Error {
  /** Stable machine-readable error code. */
  readonly code: CasperProofErrorCode;
  /** HTTP status associated with the error. */
  readonly status: number;
  /** Optional structured detail (RFC 7807 extension members). */
  readonly detail?: Record<string, unknown>;

  constructor(
    code: CasperProofErrorCode,
    message: string,
    detail?: Record<string, unknown>,
    status?: number,
  ) {
    super(message);
    this.name = 'CasperProofSdkError';
    this.code = code;
    this.status = status ?? statusForCode(code);
    if (detail !== undefined) {
      this.detail = detail;
    }
    // Restore the prototype chain for instanceof across the transpiled ES target.
    Object.setPrototypeOf(this, CasperProofSdkError.prototype);
  }

  /** Type guard for {@link CasperProofSdkError}. */
  static is(value: unknown): value is CasperProofSdkError {
    return value instanceof CasperProofSdkError;
  }
}

/** Convenience constructor for {@link CasperProofSdkError.code} `ATTESTATION_NOT_FOUND`. */
export function attestationNotFound(id: number): CasperProofSdkError {
  return new CasperProofSdkError(
    'ATTESTATION_NOT_FOUND',
    `No attestation exists with id ${id}.`,
    { attestation_id: id },
  );
}

/** Convenience constructor for `POLICY_NOT_FOUND`. */
export function policyNotFound(id: number): CasperProofSdkError {
  return new CasperProofSdkError('POLICY_NOT_FOUND', `No insurance policy exists with id ${id}.`, {
    policy_id: id,
  });
}

/** Convenience constructor for `INSUFFICIENT_STAKE`. */
export function insufficientStake(required: string, provided: string): CasperProofSdkError {
  return new CasperProofSdkError(
    'INSUFFICIENT_STAKE',
    `Attached stake ${provided} is below the required minimum ${required}.`,
    { required_stake: required, provided_stake: provided },
  );
}

/** Convenience constructor for `TAMPERED_PAYLOAD` (verification FAIL). */
export function tamperedPayload(
  id: number,
  onchainHash: string,
  recomputedHash: string,
): CasperProofSdkError {
  return new CasperProofSdkError(
    'TAMPERED_PAYLOAD',
    'The recomputed output hash does not match the on-chain commitment.',
    {
      attestation_id: id,
      onchain_hash: onchainHash,
      recomputed_hash: recomputedHash,
      valid: false,
    },
  );
}

/** Convenience constructor for `ALREADY_CHALLENGED`. */
export function alreadyChallenged(id: number): CasperProofSdkError {
  return new CasperProofSdkError('ALREADY_CHALLENGED', `Attestation ${id} is already under challenge.`, {
    attestation_id: id,
  });
}

/** Convenience constructor for `ATTESTATION_NOT_ACTIVE`. */
export function attestationNotActive(id: number, status: string): CasperProofSdkError {
  return new CasperProofSdkError(
    'ATTESTATION_NOT_ACTIVE',
    `Attestation ${id} is in state \`${status}\` and cannot be acted upon.`,
    { attestation_id: id, attestation_status: status },
  );
}

/** Convenience constructor for `POLICY_EXPIRED`. */
export function policyExpired(id: number): CasperProofSdkError {
  return new CasperProofSdkError('POLICY_EXPIRED', `Policy ${id} has expired and cannot be claimed against.`, {
    policy_id: id,
  });
}

/** Convenience constructor for `TRIGGER_NOT_COVERED`. */
export function triggerNotCovered(policyId: number, trigger: string): CasperProofSdkError {
  return new CasperProofSdkError(
    'TRIGGER_NOT_COVERED',
    `Trigger \`${trigger}\` is not covered by policy ${policyId}.`,
    { policy_id: policyId, trigger },
  );
}

/** Convenience constructor for `VAULT_INSOLVENT`. */
export function vaultInsolvent(required: string, available: string): CasperProofSdkError {
  return new CasperProofSdkError(
    'VAULT_INSOLVENT',
    `Vault cannot cover payout of ${required}; only ${available} is available.`,
    { required, available },
  );
}

/** Convenience constructor for `INTERNAL_ERROR`. */
export function internalError(message: string): CasperProofSdkError {
  return new CasperProofSdkError('INTERNAL_ERROR', message);
}

/**
 * Map an RFC 7807 `application/problem+json` body (as returned by the CSPR.cloud-fronted
 * services) plus the HTTP status to a typed {@link CasperProofSdkError}.
 *
 * The `code` member is preferred; if absent or unknown, the status is mapped to the closest
 * code (see {@link CODE_BY_STATUS}), defaulting to `INTERNAL_ERROR`.
 */
export function errorFromProblem(status: number, body: unknown): CasperProofSdkError {
  const problem = (body && typeof body === 'object' ? (body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const rawCode = problem['code'];
  const code: CasperProofErrorCode = isErrorCode(rawCode)
    ? rawCode
    : (CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR');

  const title = typeof problem['title'] === 'string' ? (problem['title'] as string) : undefined;
  const detailText = typeof problem['detail'] === 'string' ? (problem['detail'] as string) : undefined;
  const message = detailText ?? title ?? `Request failed with status ${status}.`;

  // Preserve every RFC 7807 extension member except the standard ones as structured detail.
  const detail: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(problem)) {
    if (key === 'type' || key === 'title' || key === 'status' || key === 'detail' || key === 'code') {
      continue;
    }
    detail[key] = value;
  }

  return new CasperProofSdkError(
    code,
    message,
    Object.keys(detail).length > 0 ? detail : undefined,
    status,
  );
}
