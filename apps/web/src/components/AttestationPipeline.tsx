/**
 * AttestationPipeline — the animated risk-assessment experience.
 *
 * Drives a three-phase state machine, restyled to the CasperProof brand:
 *
 *   1. Collect — a spinning orb + indeterminate progress while the overall
 *      score is fetched from the SDK; data-source badges light up in sequence.
 *   2. Analyze — steps through the 15 factors (grouped by category): each goes
 *      pending → scanning (progress bar + cycling micro-explanation) → done
 *      (rating badge in tier colour, value, and a one-line explanation), joined
 *      by a morphing vertical connector.
 *   3. Summary — reveals the overall RingGauge (% score + tier) and a CTA to
 *      the full shareable result.
 *
 * The overall score comes from `sdk.getRiskScore` (deterministic in mock mode);
 * the per-factor detail comes from `computeFactors`. Pure React + RAF/intervals
 * + CSS, honouring `prefers-reduced-motion` (jumps straight to the summary).
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  RingGauge,
  Reveal,
  prefersReducedMotion,
  tierColor,
  tierForScore,
} from '@casperproof/ui';
import type { Tier } from '@casperproof/ui';
import { getSdk } from '@/lib/sdk';
import {
  FACTORS,
  FACTOR_GROUPS,
  computeCategories,
  computeFactors,
  type FactorGroup,
  type FactorResult,
} from '@/lib/riskFactors';

/** Ordered on-chain data sources surfaced during the collect phase. */
const DATA_SOURCES = ['deploys', 'balances', 'transfers', 'events', 'reputation'] as const;
const GROUP_ORDER: FactorGroup[] = ['TRANSACTION', 'PROTOCOL', 'SECURITY', 'IDENTITY'];

type Phase = 'collect' | 'analyze' | 'summary';
type StepState = 'pending' | 'scanning' | 'done';

export interface AttestationPipelineProps {
  /** The assessment seed (address / input text) — scored via the SDK. */
  input: string;
  /** Link target for the full shareable result. */
  resultHref: string;
  /** Optional callback fired once the summary is revealed. */
  onComplete?: () => void;
}

/** Deterministic per-step scan duration (ms) so timing is stable per input. */
function stepDuration(input: string, index: number): number {
  let h = 2166136261;
  const s = `${input}:${index}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return 820 + ((h >>> 0) % 620); // 820–1440ms
}

export function AttestationPipeline({
  input,
  resultHref,
  onComplete,
}: AttestationPipelineProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('collect');
  const [score, setScore] = useState<number | null>(null);
  const [collectProgress, setCollectProgress] = useState(0);
  const [stepStates, setStepStates] = useState<StepState[]>(() => FACTORS.map(() => 'pending'));
  const [scanLine, setScanLine] = useState<number[]>(() => FACTORS.map(() => 0));
  const [stepProgress, setStepProgress] = useState<number[]>(() => FACTORS.map(() => 0));
  const animating = useRef(true);

  const factors = useMemo(
    () => (score == null ? null : computeFactors(input, score)),
    [input, score],
  );
  const tier: Tier = score == null ? 'LOW' : tierForScore(score);

  // Track mount so async work never updates an unmounted tree.
  useEffect(() => {
    animating.current = true;
    return () => {
      animating.current = false;
    };
  }, []);

  // Fetch the overall score from the SDK (deterministic mock in offline mode).
  useEffect(() => {
    let active = true;
    void getSdk()
      .getRiskScore(input)
      .then((r) => {
        if (active) setScore(r.score);
      })
      .catch(() => {
        if (active) setScore(0);
      });
    return () => {
      active = false;
    };
  }, [input]);

  // Collect-phase progress bar (indeterminate, asymptotic toward ~92%).
  useEffect(() => {
    if (phase !== 'collect' || prefersReducedMotion()) return;
    const id = setInterval(() => {
      setCollectProgress((p) => p + (0.92 - p) * 0.06);
    }, 90);
    return () => clearInterval(id);
  }, [phase]);

  // Transition collect → analyze once the score is in (or jump straight to the
  // summary when reduced motion is preferred).
  useEffect(() => {
    if (phase !== 'collect' || score == null) return;
    if (prefersReducedMotion()) {
      setStepStates(FACTORS.map(() => 'done'));
      setStepProgress(FACTORS.map(() => 1));
      setCollectProgress(1);
      setPhase('summary');
      onComplete?.();
      return;
    }
    const id = setTimeout(() => setPhase('analyze'), 1300);
    return () => clearTimeout(id);
  }, [phase, score, onComplete]);

  // Analyze-phase: step sequentially through the 15 factors.
  useEffect(() => {
    if (phase !== 'analyze') return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const intervals: Array<ReturnType<typeof setInterval>> = [];
    let step = 0;

    const runStep = (): void => {
      if (!animating.current) return;
      if (step >= FACTORS.length) {
        timers.push(
          setTimeout(() => {
            if (!animating.current) return;
            setPhase('summary');
            onComplete?.();
          }, 450),
        );
        return;
      }
      const cur = step;
      setStepStates((prev) => prev.map((s, i) => (i === cur ? 'scanning' : s)));

      const total = stepDuration(input, cur);
      const start = Date.now();
      const prog = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / total);
        setStepProgress((arr) => arr.map((x, i) => (i === cur ? p : x)));
        if (p >= 1) clearInterval(prog);
      }, 60);
      intervals.push(prog);

      let line = 0;
      const cyc = setInterval(() => {
        line += 1;
        if (line < 3) setScanLine((arr) => arr.map((x, i) => (i === cur ? line : x)));
      }, total / 3);
      intervals.push(cyc);

      timers.push(
        setTimeout(() => {
          clearInterval(prog);
          clearInterval(cyc);
          setStepProgress((arr) => arr.map((x, i) => (i === cur ? 1 : x)));
          setStepStates((prev) => prev.map((s, i) => (i === cur ? 'done' : s)));
          step += 1;
          timers.push(setTimeout(runStep, 180));
        }, total),
      );
    };

    runStep();
    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [phase, input, onComplete]);

  const categories = useMemo(() => (factors ? computeCategories(factors) : []), [factors]);

  return (
    <div className="attn-pipeline stack">
      {phase === 'collect' && <CollectPhase progress={collectProgress} />}

      {(phase === 'analyze' || phase === 'summary') && (
        <div className="attn-collected cp-fade-in" role="status">
          <span aria-hidden="true">✓</span>
          <span>On-chain data collected</span>
          <span className="attn-collected__meta mono">
            {DATA_SOURCES.length} sources · {FACTORS.length} factors
          </span>
        </div>
      )}

      {(phase === 'analyze' || phase === 'summary') && factors && (
        <AnalyzePipeline
          factors={factors}
          stepStates={stepStates}
          scanLine={scanLine}
          stepProgress={stepProgress}
        />
      )}

      {phase === 'summary' && score != null && (
        <Reveal className="attn-summary">
          <div className="attn-summary__divider" aria-hidden="true" />
          <div className="attn-summary__inner">
            <RingGauge value={score} tier={tier} size={200} />
            <div className="stack" style={{ gap: 'var(--cp-space-md)' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                Risk score {score}
                <span className="attn-tier" style={{ color: tierColor(tier) }}>
                  {' '}
                  · {tier}
                </span>
              </h2>
              <div className="attn-catrow">
                {categories.map((c) => (
                  <div key={c.group} className="attn-catpill">
                    <span className="attn-catpill__label">{c.label}</span>
                    <span className="attn-catpill__score" style={{ color: tierColor(c.tier) }}>
                      {c.score}
                    </span>
                  </div>
                ))}
              </div>
              <div className="row">
                <Link href={resultHref}>
                  <Button variant="primary">View full result</Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/** Phase 1 — collecting on-chain data. */
function CollectPhase({ progress }: { progress: number }): JSX.Element {
  return (
    <Card className="attn-collect">
      <div className="attn-collect__head">
        <span className="attn-orb" aria-hidden="true">
          <span className="attn-orb__inner cp-spin">◆</span>
        </span>
        <div className="attn-collect__copy">
          <div className="attn-collect__title">Collecting on-chain data</div>
          <div className="attn-collect__sub cp-pulse mono">
            indexing CSPR.cloud · deploys, balances, transfers, events…
          </div>
        </div>
      </div>
      <div className="attn-track" aria-hidden="true">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="attn-sources">
        {DATA_SOURCES.map((label, i) => {
          const lit = progress > (i + 1) * 0.16;
          return (
            <span key={label} className={`attn-source${lit ? ' attn-source--lit' : ''}`}>
              {lit ? '✓ ' : ''}
              {label}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/** Phase 2 — the analysis pipeline of 15 factors grouped by category. */
function AnalyzePipeline({
  factors,
  stepStates,
  scanLine,
  stepProgress,
}: {
  factors: ReadonlyArray<FactorResult>;
  stepStates: StepState[];
  scanLine: number[];
  stepProgress: number[];
}): JSX.Element {
  // Map factor key → its flat index so connectors/state line up with the model.
  return (
    <div className="attn-groups">
      {GROUP_ORDER.map((group) => {
        const members = factors.filter((f) => f.group === group);
        return (
          <Card key={group} className="attn-group">
            <div className="attn-group__head">{FACTOR_GROUPS[group].label}</div>
            <div className="attn-steps">
              {members.map((f, idxInGroup) => {
                const index = FACTORS.findIndex((d) => d.key === f.key);
                const state = stepStates[index] ?? 'pending';
                return (
                  <StepRow
                    key={f.key}
                    factor={f}
                    state={state}
                    scanLine={scanLine[index] ?? 0}
                    progress={stepProgress[index] ?? 0}
                    last={idxInGroup === members.length - 1}
                  />
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** A single factor row: rail (icon + connector) + body (title / scan / result). */
function StepRow({
  factor,
  state,
  scanLine,
  progress,
  last,
}: {
  factor: FactorResult;
  state: StepState;
  scanLine: number;
  progress: number;
  last: boolean;
}): JSX.Element {
  const color = tierColor(factor.tier);
  return (
    <div
      className="attn-step"
      style={{ opacity: state === 'pending' ? 0.4 : 1 }}
      data-state={state}
    >
      <div className="attn-step__rail">
        <span
          className={`attn-step__icon attn-step__icon--${state}`}
          style={state === 'done' ? { color, borderColor: color } : undefined}
        >
          {state === 'done' ? (
            '✓'
          ) : state === 'scanning' ? (
            <span className="attn-step__spin cp-spin" />
          ) : (
            '·'
          )}
        </span>
        {!last && (
          <span
            className="attn-step__connector"
            style={{
              background:
                state === 'done'
                  ? color
                  : state === 'scanning'
                    ? 'var(--cp-color-info)'
                    : 'var(--cp-color-border)',
            }}
          />
        )}
      </div>
      <div className="attn-step__body">
        <div className="attn-step__titlerow">
          <span
            className="attn-step__title"
            style={{ color: state === 'done' ? color : undefined }}
          >
            {factor.label}
          </span>
          {state === 'done' && (
            <>
              <span
                className="attn-rating"
                style={{ color, borderColor: color, background: 'transparent' }}
              >
                {factor.tier}
              </span>
              <span className="attn-step__value mono">{factor.value}</span>
            </>
          )}
        </div>
        {state === 'scanning' && (
          <div className="attn-step__scanning">
            <p className="attn-scan cp-pulse mono">{factor.scan[scanLine] ?? factor.scan[0]}</p>
            <div className="attn-track attn-track--thin" aria-hidden="true">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
        {state === 'done' && <p className="attn-step__desc muted">{factor.explanation}</p>}
        {state === 'pending' && <p className="attn-step__desc muted">Queued…</p>}
      </div>
    </div>
  );
}
