/**
 * AttestationResult — the shareable percentage result page.
 *
 * Fully determined by its `id` (a base64url-encoded seed): it decodes the seed,
 * reads the overall score from the SDK, and reconstructs the 15-factor
 * breakdown via `computeFactors`. So a shared link reproduces an identical
 * assessment for anyone who opens it.
 *
 * Layout: a hero RingGauge (big % + tier) with a tier-coloured verdict line, the
 * four category mini-cards (score + rating + bar), a detailed factor grid
 * (label, rating badge, value, explanation), and share affordances. Everything
 * fades in with a staggered <Reveal>.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Reveal, RingGauge, tierBg, tierColor, tierForScore } from '@casperproof/ui';
import type { Tier } from '@casperproof/ui';
import { getSdk } from '@/lib/sdk';
import { formatHash } from '@/lib/format';
import {
  FACTOR_GROUPS,
  computeCategories,
  computeFactors,
  decodeSeed,
  verdictForTier,
  type FactorGroup,
  type FactorResult,
} from '@/lib/riskFactors';

const GROUP_ORDER: FactorGroup[] = ['TRANSACTION', 'PROTOCOL', 'SECURITY', 'IDENTITY'];

export function AttestationResult({ id }: { id: string }): JSX.Element {
  // Decode the seed from the id; an undecodable id renders the not-found state.
  const seed = useMemo(() => {
    try {
      const s = decodeSeed(id);
      return s.length > 0 ? s : null;
    } catch {
      return null;
    }
  }, [id]);

  const [score, setScore] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (seed == null) return;
    let active = true;
    void getSdk()
      .getRiskScore(seed)
      .then((r) => {
        if (active) setScore(r.score);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [seed]);

  if (seed == null || failed) {
    return (
      <div className="stack" style={{ gap: 'var(--cp-space-lg)' }}>
        <header className="page-header">
          <h1>Assessment not found</h1>
          <p>This result id could not be decoded into an assessment.</p>
        </header>
        <div className="row">
          <Link href="/attest">
            <Button variant="primary">Run a new assessment</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (score == null) {
    return (
      <div className="empty" role="status">
        <span className="cp-pulse mono" style={{ color: 'var(--cp-color-info)' }}>
          reconstructing assessment…
        </span>
      </div>
    );
  }

  return <ResultBody seed={seed} score={score} />;
}

function ResultBody({ seed, score }: { seed: string; score: number }): JSX.Element {
  const tier: Tier = tierForScore(score);
  const factors = useMemo(() => computeFactors(seed, score), [seed, score]);
  const categories = useMemo(() => computeCategories(factors), [factors]);
  const verdict = verdictForTier(tier);
  const verdictColor = verdict.insurable ? tierColor(tier) : tierColor('EXTREME');

  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href);
  }, []);

  const onShare = (): void => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tweetText = `CasperProof scored this agent ${score}/100 (${tier}) across 15 on-chain risk factors.`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}${shareUrl ? `&url=${encodeURIComponent(shareUrl)}` : ''}`;

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-xl)' }}>
      {/* Header + share row */}
      <Reveal className="attn-result-head">
        <div className="attn-result-head__id">
          <span className="attn-label" style={{ color: 'var(--cp-color-info)' }}>
            Risk assessment · complete
          </span>
          <span className="mono attn-result-head__seed">{formatHash(seed, 16, 8)}</span>
        </div>
        <span className="attn-result-head__meta mono">
          {factors.length} factors · {categories.length} categories
        </span>
        <Button variant="secondary" size="sm" onClick={onShare} aria-label="Copy result link">
          {copied ? '✓ copied' : 'Share result'}
        </Button>
        <a
          className="cp-button cp-button--sm cp-button--secondary"
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Post on X
        </a>
        <Link href="/attest" className="cp-button cp-button--sm cp-button--ghost">
          New assessment
        </Link>
      </Reveal>

      {/* Hero */}
      <Reveal delay={60}>
        <Card className="attn-hero">
          <div className="attn-hero__gauge">
            <RingGauge value={score} tier={tier} size={240} />
          </div>
          <div className="attn-hero__body stack">
            <div>
              <span className="attn-label">Overall risk score</span>
              <div className="attn-hero__score mono">
                {score}
                <span className="attn-hero__outof">/100</span>
              </div>
            </div>
            <div
              className="attn-verdict"
              style={{ borderColor: verdictColor, background: tierBg(tier) }}
            >
              <span className="attn-verdict__dot" style={{ background: verdictColor }} />
              <span className="attn-verdict__text" style={{ color: verdictColor }}>
                <strong>{tier}</strong> — {verdict.detail}
              </span>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Category mini-cards */}
      <div className="attn-catgrid">
        {categories.map((c, i) => (
          <Reveal key={c.group} delay={140 + i * 80}>
            <Card className="attn-cat" style={{ background: tierBg(c.tier, 0.07) }}>
              <div className="attn-label attn-cat__label">{c.label}</div>
              <div className="attn-cat__scorerow">
                <span className="attn-cat__score mono" style={{ color: tierColor(c.tier) }}>
                  {c.score}
                </span>
                <span
                  className="attn-rating"
                  style={{ color: tierColor(c.tier), borderColor: tierColor(c.tier) }}
                >
                  {c.tier}
                </span>
              </div>
              <div className="attn-track" aria-hidden="true">
                <i style={{ width: `${c.score}%`, background: tierColor(c.tier) }} />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* Detailed factor grid, grouped by category */}
      <div className="attn-factorcols">
        {GROUP_ORDER.map((group, i) => {
          const members = factors.filter((f) => f.group === group);
          return (
            <Reveal key={group} delay={460 + i * 80}>
              <Card className="attn-factorcol">
                <div className="attn-label">{FACTOR_GROUPS[group].label}</div>
                <p className="muted attn-factorcol__blurb">{FACTOR_GROUPS[group].blurb}</p>
                <div className="attn-factorlist">
                  {members.map((f) => (
                    <FactorDetailRow key={f.key} factor={f} />
                  ))}
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function FactorDetailRow({ factor }: { factor: FactorResult }): JSX.Element {
  const color = tierColor(factor.tier);
  return (
    <div className="attn-factor">
      <span className="attn-factor__dot" style={{ background: color }} aria-hidden="true" />
      <div className="attn-factor__body">
        <div className="attn-factor__titlerow">
          <span className="attn-factor__label">{factor.label}</span>
          <span className="attn-rating" style={{ color, borderColor: color }}>
            {factor.tier}
          </span>
          <span className="attn-factor__value mono">{factor.value}</span>
        </div>
        <p className="muted attn-factor__desc">{factor.explanation}</p>
      </div>
    </div>
  );
}
