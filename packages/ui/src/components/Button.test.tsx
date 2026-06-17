import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { click, render } from '../test-utils.js';

describe('Button', () => {
  it('renders a semantic button with default primary/md classes', () => {
    const { container, unmount } = render(<Button>Go</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.type).toBe('button');
    expect(btn.className).toContain('cp-button--primary');
    expect(btn.className).toContain('cp-button--md');
    expect(btn.textContent).toBe('Go');
    unmount();
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('renders %s variant', (variant) => {
    const { container, unmount } = render(<Button variant={variant}>x</Button>);
    expect(container.querySelector('button')!.className).toContain(`cp-button--${variant}`);
    unmount();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders %s size', (size) => {
    const { container, unmount } = render(<Button size={size}>x</Button>);
    expect(container.querySelector('button')!.className).toContain(`cp-button--${size}`);
    unmount();
  });

  it('supports block, custom className, type override and click', () => {
    const onClick = vi.fn();
    const { container, unmount } = render(
      <Button block type="submit" className="extra" onClick={onClick}>
        Submit
      </Button>,
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('cp-button--block');
    expect(btn.className).toContain('extra');
    expect(btn.type).toBe('submit');
    click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
  });
});
