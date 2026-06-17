import { Card, Badge } from './ui';
import { ROADMAP } from '../lib/content';
import type { RoadmapItem } from '../lib/content';

const STATUS_BADGE: Record<RoadmapItem['status'], { status: 'pass' | 'challenged' | 'finalized'; label: string }> = {
  shipped: { status: 'pass', label: 'Shipped' },
  'in-progress': { status: 'challenged', label: 'In progress' },
  planned: { status: 'finalized', label: 'Planned' },
};

/** "Roadmap" — phased delivery with explicit status badges. */
export function Roadmap(): JSX.Element {
  return (
    <section id="roadmap" className="mk-section" aria-labelledby="roadmap-title">
      <div className="mk-container">
        <p className="mk-eyebrow">Roadmap</p>
        <h2 id="roadmap-title" className="mk-section__title">
          From testnet oracle to a mainnet trust layer.
        </h2>
        <div className="mk-grid mk-grid--3">
          {ROADMAP.map((item) => {
            const badge = STATUS_BADGE[item.status];
            return (
              <Card key={item.phase} style={{ height: '100%' }}>
                <div className="mk-roadmap-head">
                  <span className="mk-eyebrow" style={{ margin: 0 }}>
                    {item.phase}
                  </span>
                  <Badge status={badge.status}>{badge.label}</Badge>
                </div>
                <h3 className="mk-card-title">{item.title}</h3>
                <p className="mk-card-body">{item.body}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
