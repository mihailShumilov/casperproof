import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile.js';
import { render } from '../test-utils.js';

describe('StatTile', () => {
  it('renders label + value without a delta', () => {
    const { container, unmount } = render(<StatTile label="TVL" value="1.2M" />);
    expect(container.querySelector('.cp-stattile__label')!.textContent).toBe('TVL');
    expect(container.querySelector('.cp-stattile__value')!.textContent).toBe('1.2M');
    expect(container.querySelector('.cp-stattile__delta')).toBeNull();
    unmount();
  });

  it.each(['up', 'down', 'neutral'] as const)('renders %s delta direction', (dir) => {
    const { container, unmount } = render(
      <StatTile label="L" value="1" delta="+1%" deltaDirection={dir} />,
    );
    const delta = container.querySelector('.cp-stattile__delta')!;
    expect(delta.className).toContain(`cp-stattile__delta--${dir}`);
    expect(delta.textContent).toBe('+1%');
    unmount();
  });

  it('defaults delta direction to neutral', () => {
    const { container, unmount } = render(<StatTile label="L" value="1" delta="0%" />);
    expect(container.querySelector('.cp-stattile__delta')!.className).toContain(
      'cp-stattile__delta--neutral',
    );
    unmount();
  });
});
