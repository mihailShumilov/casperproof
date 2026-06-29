'use client';

/**
 * `RingGauge` — an animated SVG risk gauge.
 *
 * Draws 40 radial ticks (lit up to the value), an animated stroke-dasharray
 * sweep, and a center read-out (big value + tier label). The sweep animates
 * with a cubic-out ease over ~1600ms via requestAnimationFrame, honouring
 * `prefers-reduced-motion`. Color is derived from the {@link Tier}.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { prefersReducedMotion } from '../motion.js';
import { tierColor } from '../risk.js';
import type { Tier } from '../risk.js';

export interface RingGaugeProps {
  /** Risk score, 0–100. Drives the sweep + center number. */
  value: number;
  /** Risk tier — drives the gauge color and the default sub-label. */
  tier: Tier;
  /** Square pixel size of the SVG. Defaults to `220`. */
  size?: number;
  /** Sub-label override. Defaults to the tier name. Rendered uppercase. */
  label?: string;
  /** Extra class names on the `<svg>`. */
  className?: string;
}

const TICK_COUNT = 40;
const SWEEP_MS = 1600;

/** A circular, tick-marked gauge for a 0–100 risk score. */
export function RingGauge({
  value,
  tier,
  size = 220,
  label,
  className,
}: RingGaugeProps): JSX.Element {
  const [shown, setShown] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / SWEEP_MS);
      setShown(value * (1 - Math.pow(1 - p, 3))); // cubic-out
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value]);

  const stroke = 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const color = tierColor(tier);
  const fraction = Math.max(0, Math.min(1, shown / 100));
  const sublabel = (label ?? tier).toUpperCase();

  const ticks = useMemo(
    () => Array.from({ length: TICK_COUNT }, (_, i) => (i / TICK_COUNT) * Math.PI * 2),
    [],
  );

  return (
    <svg
      className={clsx('cp-ring', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Risk score ${Math.round(shown)} of 100, ${tier} tier`}
    >
      {ticks.map((a, i) => {
        const r1 = r - 9;
        const r2 = r - 14;
        const lit = i / TICK_COUNT <= fraction;
        // Fixed precision keeps SSR and client markup byte-identical.
        return (
          <line
            key={i}
            x1={(cx + Math.cos(a - Math.PI / 2) * r1).toFixed(2)}
            y1={(cy + Math.sin(a - Math.PI / 2) * r1).toFixed(2)}
            x2={(cx + Math.cos(a - Math.PI / 2) * r2).toFixed(2)}
            y2={(cy + Math.sin(a - Math.PI / 2) * r2).toFixed(2)}
            stroke={lit ? color : 'var(--cp-color-border)'}
            strokeWidth="1.5"
          />
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--cp-color-surfaceRaised)"
        strokeWidth={stroke}
      />
      <circle
        className="cp-ring__sweep"
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(circumference * fraction).toFixed(2)} ${circumference.toFixed(2)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--cp-color-text)"
        fontFamily="var(--cp-font-mono)"
        fontWeight="700"
        fontSize={size * 0.26}
        letterSpacing="-0.02em"
      >
        {Math.round(shown)}
      </text>
      <text
        className="cp-ring__label"
        x="50%"
        y="63%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily="var(--cp-font-mono)"
        fontWeight="700"
        fontSize={size * 0.07}
        letterSpacing="0.22em"
      >
        {sublabel}
      </text>
    </svg>
  );
}
