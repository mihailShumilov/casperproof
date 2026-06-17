import { describe, expect, it } from 'vitest';
import { Card } from './Card.js';
import { render } from '../test-utils.js';

describe('Card', () => {
  it('renders children inside a card surface', () => {
    const { container, unmount } = render(<Card>body</Card>);
    const card = container.querySelector('.cp-card')!;
    expect(card.textContent).toBe('body');
    expect(card.className).not.toContain('cp-card--interactive');
    unmount();
  });

  it('applies interactive + custom className', () => {
    const { container, unmount } = render(
      <Card interactive className="mine">
        x
      </Card>,
    );
    const card = container.querySelector('.cp-card')!;
    expect(card.className).toContain('cp-card--interactive');
    expect(card.className).toContain('mine');
    unmount();
  });
});
