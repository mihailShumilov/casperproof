import { Card, Tag } from './ui';
import { USE_CASES } from '../lib/content';

/** "Use cases": RWA oracle, DeFi insurance, compliance. */
export function UseCases(): JSX.Element {
  return (
    <section id="use-cases" className="mk-section" aria-labelledby="use-cases-title">
      <div className="mk-container">
        <p className="mk-eyebrow">Use cases</p>
        <h2 id="use-cases-title" className="mk-section__title">
          Wherever an agent&rsquo;s word needs to be worth something.
        </h2>
        <div className="mk-grid mk-grid--3">
          {USE_CASES.map((useCase) => (
            <Card key={useCase.title} interactive style={{ height: '100%' }}>
              <Tag>{useCase.tag}</Tag>
              <h3 className="mk-card-title" style={{ marginTop: 'var(--cp-space-md)' }}>
                {useCase.title}
              </h3>
              <p className="mk-card-body">{useCase.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
