/**
 * Recharts wrappers for the insurance view.
 *
 * `SolvencyChart` renders the vault coverage-vs-premium balance as bars;
 * `RiskGauge` renders a single address's risk score as a horizontal bar against
 * the 0–100 scale. Colors come from the design tokens (read as CSS hex so they
 * pass into SVG fills, which can't resolve `var(--cp-*)`).
 */
'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { colors } from '@casperproof/ui/tokens';

export interface SolvencyDatum {
  name: string;
  value: number;
}

/** Vault solvency: coverage outstanding vs premiums collected vs free reserve. */
export function SolvencyChart({ data }: { data: SolvencyDatum[] }): JSX.Element {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis dataKey="name" stroke={colors.textMuted} fontSize={12} tickLine={false} />
          <YAxis stroke={colors.textMuted} fontSize={12} tickLine={false} width={48} />
          <Tooltip
            cursor={{ fill: colors.surfaceRaised }}
            contentStyle={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={
                  d.name === 'Coverage'
                    ? colors.warn
                    : d.name === 'Premiums'
                      ? colors.proof
                      : colors.info
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A single risk score (0–100) rendered as one bar, colored by tier. */
export function RiskGauge({ score, tier }: { score: number; tier: string }): JSX.Element {
  const fill = tier === 'HIGH' ? colors.fail : tier === 'MEDIUM' ? colors.warn : colors.proof;
  const data = [{ name: 'Risk', value: score }];
  return (
    <div className="chart-wrap" style={{ height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke={colors.textMuted} fontSize={12} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            cursor={{ fill: colors.surfaceRaised }}
            contentStyle={{
              background: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={fill} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
