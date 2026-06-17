import { describe, expect, it } from 'vitest';
import { Badge } from './Badge.js';
import type { BadgeStatus } from './Badge.js';
import { render } from '../test-utils.js';

const STATUSES: BadgeStatus[] = ['active', 'challenged', 'slashed', 'finalized', 'pass', 'fail'];

describe('Badge', () => {
  it.each(STATUSES)('renders %s status with default label + dot', (status) => {
    const { container, unmount } = render(<Badge status={status} />);
    const badge = container.querySelector('.cp-badge')!;
    expect(badge.className).toContain(`cp-badge--${status}`);
    expect(badge.querySelector('.cp-badge__dot')).not.toBeNull();
    // default label is the capitalized status
    const expected = status.charAt(0).toUpperCase() + status.slice(1);
    expect(badge.textContent).toContain(expected);
    unmount();
  });

  it('hides the dot when dot=false and supports custom label', () => {
    const { container, unmount } = render(
      <Badge status="active" dot={false}>
        Live
      </Badge>,
    );
    const badge = container.querySelector('.cp-badge')!;
    expect(badge.querySelector('.cp-badge__dot')).toBeNull();
    expect(badge.textContent).toBe('Live');
    unmount();
  });
});
