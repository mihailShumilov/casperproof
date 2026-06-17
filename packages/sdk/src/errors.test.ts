import { describe, expect, it } from 'vitest';
import {
  alreadyChallenged,
  attestationNotActive,
  attestationNotFound,
  CasperProofSdkError,
  ERROR_CODES,
  errorFromProblem,
  insufficientStake,
  internalError,
  isErrorCode,
  policyExpired,
  policyNotFound,
  PROBLEM_BASE,
  statusForCode,
  tamperedPayload,
  triggerNotCovered,
  typeUriForCode,
  vaultInsolvent,
} from './errors.js';

describe('error code metadata', () => {
  it('maps every code to a status and a type URI', () => {
    for (const code of ERROR_CODES) {
      expect(statusForCode(code)).toBeGreaterThanOrEqual(400);
      expect(typeUriForCode(code)).toContain(PROBLEM_BASE);
    }
  });

  it('mirrors the Rust status mapping exactly', () => {
    expect(statusForCode('ATTESTATION_NOT_FOUND')).toBe(404);
    expect(statusForCode('POLICY_NOT_FOUND')).toBe(404);
    expect(statusForCode('INSUFFICIENT_STAKE')).toBe(422);
    expect(statusForCode('TAMPERED_PAYLOAD')).toBe(422);
    expect(statusForCode('TRIGGER_NOT_COVERED')).toBe(422);
    expect(statusForCode('DISPUTE_WINDOW_CLOSED')).toBe(409);
    expect(statusForCode('ALREADY_CHALLENGED')).toBe(409);
    expect(statusForCode('ATTESTATION_NOT_ACTIVE')).toBe(409);
    expect(statusForCode('POLICY_EXPIRED')).toBe(409);
    expect(statusForCode('VAULT_INSOLVENT')).toBe(409);
    expect(statusForCode('UNAUTHORIZED')).toBe(403);
    expect(statusForCode('PAYLOAD_UNAVAILABLE')).toBe(502);
    expect(statusForCode('PAYMENT_REQUIRED')).toBe(402);
    expect(statusForCode('INTERNAL_ERROR')).toBe(500);
  });

  it('builds canonical type URIs', () => {
    expect(typeUriForCode('ATTESTATION_NOT_FOUND')).toBe(
      'https://casperproof.com/problems/attestation-not-found',
    );
  });

  it('isErrorCode recognizes known codes only', () => {
    expect(isErrorCode('ATTESTATION_NOT_FOUND')).toBe(true);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});

describe('CasperProofSdkError', () => {
  it('derives the status from the code by default', () => {
    const err = new CasperProofSdkError('ATTESTATION_NOT_FOUND', 'nope');
    expect(err.status).toBe(404);
    expect(err.code).toBe('ATTESTATION_NOT_FOUND');
    expect(err.detail).toBeUndefined();
    expect(err.name).toBe('CasperProofSdkError');
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts an explicit status and detail', () => {
    const err = new CasperProofSdkError('TAMPERED_PAYLOAD', 'bad', { valid: false }, 418);
    expect(err.status).toBe(418);
    expect(err.detail).toEqual({ valid: false });
  });

  it('is recognized by its static type guard and instanceof', () => {
    const err = internalError('boom');
    expect(CasperProofSdkError.is(err)).toBe(true);
    expect(CasperProofSdkError.is(new Error('x'))).toBe(false);
    expect(err instanceof CasperProofSdkError).toBe(true);
  });
});

describe('convenience constructors', () => {
  it('attestationNotFound', () => {
    const e = attestationNotFound(7);
    expect(e.code).toBe('ATTESTATION_NOT_FOUND');
    expect(e.detail).toEqual({ attestation_id: 7 });
  });
  it('policyNotFound', () => {
    expect(policyNotFound(3).detail).toEqual({ policy_id: 3 });
  });
  it('insufficientStake', () => {
    const e = insufficientStake('10', '1');
    expect(e.code).toBe('INSUFFICIENT_STAKE');
    expect(e.detail).toEqual({ required_stake: '10', provided_stake: '1' });
  });
  it('tamperedPayload', () => {
    const e = tamperedPayload(1, 'aa', 'bb');
    expect(e.code).toBe('TAMPERED_PAYLOAD');
    expect(e.detail).toEqual({
      attestation_id: 1,
      onchain_hash: 'aa',
      recomputed_hash: 'bb',
      valid: false,
    });
  });
  it('alreadyChallenged', () => {
    expect(alreadyChallenged(2).code).toBe('ALREADY_CHALLENGED');
  });
  it('attestationNotActive', () => {
    const e = attestationNotActive(2, 'Slashed');
    expect(e.detail).toEqual({ attestation_id: 2, attestation_status: 'Slashed' });
  });
  it('policyExpired', () => {
    expect(policyExpired(5).code).toBe('POLICY_EXPIRED');
  });
  it('triggerNotCovered', () => {
    const e = triggerNotCovered(5, 'exploit');
    expect(e.detail).toEqual({ policy_id: 5, trigger: 'exploit' });
  });
  it('vaultInsolvent', () => {
    const e = vaultInsolvent('9', '1');
    expect(e.detail).toEqual({ required: '9', available: '1' });
  });
});

describe('errorFromProblem', () => {
  it('uses the code member when valid', () => {
    const e = errorFromProblem(404, {
      code: 'ATTESTATION_NOT_FOUND',
      title: 'Attestation not found',
      detail: 'No attestation 9',
      status: 404,
      type: 'https://casperproof.com/problems/attestation-not-found',
      attestation_id: 9,
    });
    expect(e.code).toBe('ATTESTATION_NOT_FOUND');
    expect(e.status).toBe(404);
    expect(e.message).toBe('No attestation 9');
    expect(e.detail).toEqual({ attestation_id: 9 });
  });

  it('falls back to the status mapping when code is absent', () => {
    expect(errorFromProblem(403, { title: 'Nope' }).code).toBe('UNAUTHORIZED');
    expect(errorFromProblem(402, {}).code).toBe('PAYMENT_REQUIRED');
    expect(errorFromProblem(409, {}).code).toBe('ATTESTATION_NOT_ACTIVE');
    expect(errorFromProblem(422, {}).code).toBe('TAMPERED_PAYLOAD');
    expect(errorFromProblem(502, {}).code).toBe('PAYLOAD_UNAVAILABLE');
  });

  it('falls back to INTERNAL_ERROR for unknown status and unknown code', () => {
    const e = errorFromProblem(418, { code: 'WAT' });
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.status).toBe(418);
  });

  it('uses title when detail is missing, then a generic message', () => {
    expect(errorFromProblem(404, { title: 'Title only' }).message).toBe('Title only');
    expect(errorFromProblem(404, {}).message).toBe('Request failed with status 404.');
  });

  it('handles non-object bodies', () => {
    const e = errorFromProblem(500, 'plain text body');
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.detail).toBeUndefined();
  });

  it('omits detail when only standard members are present', () => {
    const e = errorFromProblem(404, {
      code: 'POLICY_NOT_FOUND',
      detail: 'x',
      title: 't',
      status: 404,
      type: 'u',
    });
    expect(e.detail).toBeUndefined();
  });
});
