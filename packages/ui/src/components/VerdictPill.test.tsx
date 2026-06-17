import { describe, expect, it } from 'vitest';
import { VerdictPill } from './VerdictPill.js';
import { render } from '../test-utils.js';

describe('VerdictPill', () => {
  it('renders a PASS pill with proof styling and status role', () => {
    const { container, unmount } = render(<VerdictPill verdict="pass" />);
    const pill = container.querySelector('.cp-verdict')!;
    expect(pill.className).toContain('cp-verdict--pass');
    expect(pill.getAttribute('role')).toBe('status');
    expect(pill.textContent).toContain('PASS');
    unmount();
  });

  it('renders a FAIL pill', () => {
    const { container, unmount } = render(<VerdictPill verdict="fail" />);
    const pill = container.querySelector('.cp-verdict')!;
    expect(pill.className).toContain('cp-verdict--fail');
    expect(pill.textContent).toContain('FAIL');
    unmount();
  });

  it('accepts a custom label', () => {
    const { container, unmount } = render(<VerdictPill verdict="pass">Verified</VerdictPill>);
    expect(container.querySelector('.cp-verdict')!.textContent).toContain('Verified');
    unmount();
  });
});
