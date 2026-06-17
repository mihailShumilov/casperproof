/**
 * Live event feed.
 *
 * Subscribes to the SDK event stream (`sdk.subscribeEvents`). In mock mode the
 * backend replays recent local events to new subscribers and pushes new ones as
 * writes happen across the app, so this list streams in real time as the user
 * submits attestations, challenges, resolves, and files claims. In live mode the
 * same handler receives CSPR.cloud streaming events (see SETUP_NEEDED).
 *
 * Nothing here is fabricated — every row is an actual `CasperProofEvent` emitted
 * by the SDK.
 */
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@casperproof/ui';
import type { CasperProofEvent } from '@casperproof/casper-sdk';
import { getSdk } from '@/lib/sdk';
import { formatClock, prettyJson } from '@/lib/format';

const EVENT_COLOR: Record<CasperProofEvent['name'], string> = {
  AttestationSubmitted: 'var(--cp-color-info)',
  Challenged: 'var(--cp-color-warn)',
  Resolved: 'var(--cp-color-accent)',
  ClaimPaid: 'var(--cp-color-proof)',
};

/** A monotonically-keyed feed entry (events have no unique id across types). */
interface FeedEntry {
  key: number;
  event: CasperProofEvent;
}

export function LiveFeed({ limit = 12 }: { limit?: number }): JSX.Element {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  useEffect(() => {
    let seq = 0;
    const sdk = getSdk();
    const unsubscribe = sdk.subscribeEvents((event) => {
      setEntries((prev) => {
        const next = [{ key: seq++, event }, ...prev];
        return next.slice(0, limit);
      });
    });
    return unsubscribe;
  }, [limit]);

  return (
    <Card aria-label="Live event feed">
      <div className="row row--between" style={{ marginBottom: 'var(--cp-space-md)' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Live feed
        </h2>
        <span className="muted" style={{ fontSize: 'var(--cp-fontsize-xs)' }}>
          streaming · {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="empty">
          No events yet. Submit an attestation, run the slash demo, or file a claim to see the chain
          stream live.
        </p>
      ) : (
        <ul className="feed" aria-live="polite">
          {entries.map(({ key, event }) => (
            <li key={key} className="feed-item">
              <span className="feed-item__time">{formatClock(event.timestamp)}</span>
              <span className="feed-dot" style={{ backgroundColor: EVENT_COLOR[event.name] }} />
              <span className="feed-item__name" style={{ color: EVENT_COLOR[event.name] }}>
                {event.name}
              </span>
              <span className="feed-item__data" title={prettyJson(event.data)}>
                #{event.id} · {summarize(event)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A compact, one-line summary of an event's payload for the feed row. */
function summarize(event: CasperProofEvent): string {
  const data = event.data as Record<string, unknown>;
  switch (event.name) {
    case 'AttestationSubmitted':
      return String(data.modelId ?? '');
    case 'Challenged':
      return 'bond posted';
    case 'Resolved':
      return data.fraudulent ? 'fraudulent → slashed' : 'honest → finalized';
    case 'ClaimPaid':
      return `payout ${String(data.amount ?? '')}`;
    default:
      return '';
  }
}
