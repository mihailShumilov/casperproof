import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { Reveal } from './Reveal.js';
import { render } from '../test-utils.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Reveal', () => {
  it('renders its children', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(
      <Reveal>
        <span>content</span>
      </Reveal>,
    );
    expect(container.textContent).toBe('content');
    unmount();
  });

  it('shows immediately (opacity 1, no transform) when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(
      <Reveal>
        <span>hi</span>
      </Reveal>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('1');
    expect(wrapper.style.transform).toBe('none');
    unmount();
  });

  it('starts hidden then fades + slides in after the delay when motion is allowed', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(
      <Reveal delay={100}>
        <span>hi</span>
      </Reveal>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('0');
    expect(wrapper.style.transform).toBe('translateY(14px)');

    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(wrapper.style.opacity).toBe('1');
    expect(wrapper.style.transform).toBe('none');
    unmount();
  });

  it('honours a custom target opacity and merges the caller transition', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(
      <Reveal className="my-class" style={{ opacity: 0.8, transition: 'color 1s' }}>
        <span>hi</span>
      </Reveal>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toBe('my-class');
    expect(wrapper.style.opacity).toBe('0.8');
    expect(wrapper.style.transition).toContain('color 1s');
    expect(wrapper.style.transition).toContain('opacity');
    unmount();
  });
});
