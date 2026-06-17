import { describe, expect, it } from 'vitest';
import {
  tokens,
  colors,
  spacing,
  tokensToCssVars,
  tokensToCssVarsString,
} from './tokens.js';

describe('tokens', () => {
  it('exposes the brand accent and semantic proof/fail pair', () => {
    expect(colors.accent).toMatch(/^#/);
    expect(colors.proof).toMatch(/^#/);
    expect(colors.fail).toMatch(/^#/);
    expect(tokens.colors).toBe(colors);
    expect(tokens.spacing).toBe(spacing);
  });
});

describe('tokensToCssVars', () => {
  it('emits prefixed custom properties for every group', () => {
    const vars = tokensToCssVars();
    expect(vars['--cp-color-accent']).toBe(colors.accent);
    expect(vars['--cp-space-lg']).toBe(spacing.lg);
    expect(vars['--cp-radius-md']).toBe('0.5rem');
    expect(vars['--cp-z-modal']).toBe('400'); // numeric -> stringified
    expect(vars['--cp-font-mono']).toContain('monospace');
    // every key is namespaced
    for (const key of Object.keys(vars)) {
      expect(key.startsWith('--cp-')).toBe(true);
    }
  });

  it('accepts a custom token set', () => {
    const custom = {
      ...tokens,
      colors: { ...colors, accent: '#abcabc' },
    };
    const vars = tokensToCssVars(custom);
    expect(vars['--cp-color-accent']).toBe('#abcabc');
  });
});

describe('tokensToCssVarsString', () => {
  it('renders indented declaration lines', () => {
    const str = tokensToCssVarsString();
    const lines = str.split('\n');
    expect(lines.length).toBeGreaterThan(10);
    expect(lines[0]).toMatch(/^ {2}--cp-/);
    expect(str).toContain(`--cp-color-accent: ${colors.accent};`);
  });

  it('respects a custom token set', () => {
    const custom = { ...tokens, spacing: { ...spacing, lg: '99px' } };
    expect(tokensToCssVarsString(custom)).toContain('--cp-space-lg: 99px;');
  });
});
