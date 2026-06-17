import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider.js';
import { tokens } from '../tokens.js';
import { render } from '../test-utils.js';

describe('ThemeProvider', () => {
  it('injects token CSS variables inline and renders children', () => {
    const { container, unmount } = render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>,
    );
    const root = container.querySelector('[data-cp-theme]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--cp-color-accent')).toBe(tokens.colors.accent);
    expect(root.textContent).toBe('child');
    unmount();
  });

  it('merges a caller-provided style and honours a custom theme', () => {
    const custom = { ...tokens, colors: { ...tokens.colors, accent: '#123456' } };
    const { container, unmount } = render(
      <ThemeProvider theme={custom} style={{ padding: '4px' }}>
        x
      </ThemeProvider>,
    );
    const root = container.querySelector('[data-cp-theme]') as HTMLElement;
    expect(root.style.getPropertyValue('--cp-color-accent')).toBe('#123456');
    expect(root.style.padding).toBe('4px');
    unmount();
  });
});
