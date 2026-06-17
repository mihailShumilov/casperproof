import { Card } from './ui';
import { PROBLEMS } from '../lib/content';

/** "The problem": agent outputs are unverifiable; agent capital is uninsured. */
export function Problem(): JSX.Element {
  return (
    <section id="problem" className="mk-section" aria-labelledby="problem-title">
      <div className="mk-container">
        <p className="mk-eyebrow">The problem</p>
        <h2 id="problem-title" className="mk-section__title">
          The agent economy runs on trust it hasn&rsquo;t earned.
        </h2>
        <p className="mk-section__lead">
          Autonomous agents are making real decisions with real money. Nothing proves their
          outputs are genuine, and nothing pays out when they&rsquo;re wrong.
        </p>
        <div className="mk-grid mk-grid--2">
          {PROBLEMS.map((problem) => (
            <Card key={problem.title}>
              <h3 className="mk-card-title">{problem.title}</h3>
              <p className="mk-card-body">{problem.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
