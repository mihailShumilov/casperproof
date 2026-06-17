import { Card } from './ui';
import { HOW_IT_WORKS } from '../lib/content';

/** "How it works" — three steps: attest → pay & verify → challenge/slash. */
export function HowItWorks(): JSX.Element {
  return (
    <section id="how-it-works" className="mk-section" aria-labelledby="how-title">
      <div className="mk-container">
        <p className="mk-eyebrow">How it works</p>
        <h2 id="how-title" className="mk-section__title">
          Stake, prove, and let anyone check the work.
        </h2>
        <p className="mk-section__lead">
          Three on-chain steps turn an unverifiable model output into a stake-backed, challengeable
          proof.
        </p>
        <ol className="mk-grid mk-grid--3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {HOW_IT_WORKS.map((step) => (
            <li key={step.step}>
              <Card style={{ height: '100%' }}>
                <span className="mk-step__num" aria-hidden="true">
                  {step.step}
                </span>
                <h3 className="mk-card-title">{step.title}</h3>
                <p className="mk-card-body">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
