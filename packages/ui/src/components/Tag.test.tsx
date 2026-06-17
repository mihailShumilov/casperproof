import { describe, expect, it } from 'vitest';
import { Tag } from './Tag.js';
import { render } from '../test-utils.js';

describe('Tag', () => {
  it('renders children with the tag class', () => {
    const { container, unmount } = render(<Tag>oracle</Tag>);
    const tag = container.querySelector('.cp-tag')!;
    expect(tag.textContent).toBe('oracle');
    unmount();
  });

  it('merges a custom className', () => {
    const { container, unmount } = render(<Tag className="mine">x</Tag>);
    expect(container.querySelector('.cp-tag')!.className).toContain('mine');
    unmount();
  });
});
