import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner.js';
import { render } from '../test-utils.js';

describe('Spinner', () => {
  it('renders a status role with a default visually-hidden label', () => {
    const { container, unmount } = render(<Spinner />);
    const spinner = container.querySelector('.cp-spinner')!;
    expect(spinner.getAttribute('role')).toBe('status');
    expect(spinner.className).toContain('cp-spinner--md');
    expect(spinner.querySelector('.cp-sr-only')!.textContent).toBe('Loading');
    unmount();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders %s size', (size) => {
    const { container, unmount } = render(<Spinner size={size} />);
    expect(container.querySelector('.cp-spinner')!.className).toContain(`cp-spinner--${size}`);
    unmount();
  });

  it('accepts a custom label', () => {
    const { container, unmount } = render(<Spinner label="Verifying" />);
    expect(container.querySelector('.cp-sr-only')!.textContent).toBe('Verifying');
    unmount();
  });
});
