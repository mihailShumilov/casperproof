/**
 * Hook: load the full attestation list from the SDK and re-fetch on demand.
 *
 * The mock backend has no "list" endpoint — it exposes `attestationCount()` and
 * `getAttestation(id)` — so this walks ids `1..count`. Re-fetch by calling the
 * returned `refresh`, e.g. after a submit / challenge / resolve.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Attestation } from '@casperproof/casper-sdk';
import { getSdk } from './sdk';

export interface UseAttestations {
  attestations: Attestation[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAttestations(): UseAttestations {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sdk = getSdk();
    const count = await sdk.attestationCount();
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const loaded = await Promise.all(ids.map((id) => sdk.getAttestation(id)));
    // Newest first.
    loaded.sort((a, b) => b.id - a.id);
    setAttestations(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { attestations, loading, refresh };
}
