import { BUILDER_FEATURES } from '../lib/content';
import { ClientCode } from './ClientCode';

/** "For builders" — SDK one-liner, MCP tools, and x402 pay-per-call. */
export function Builders(): JSX.Element {
  return (
    <section id="builders" className="mk-section" aria-labelledby="builders-title">
      <div className="mk-container">
        <p className="mk-eyebrow">For builders</p>
        <h2 id="builders-title" className="mk-section__title">
          Wire verifiable trust into your agents in minutes.
        </h2>
        <p className="mk-section__lead">
          One typed SDK, MCP tools for agent-to-agent verification, and native x402 metering. Works
          offline against a mock; flips to live with a single env var.
        </p>
        <div className="mk-stack-sm" style={{ display: 'grid', gap: 'var(--cp-space-2xl)' }}>
          {BUILDER_FEATURES.map((feature) => (
            <div key={feature.title} className="mk-builder">
              <div>
                <h3 className="mk-card-title">{feature.title}</h3>
                <p className="mk-card-body">{feature.body}</p>
              </div>
              <ClientCode code={feature.code} language={feature.language} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
