import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { RingGauge } from './RingGauge.js';
import { tierColor } from '../risk.js';
import { colors } from '../tokens.js';
import { render } from '../test-utils.js';

/** Force the reduced-motion path so `shown` equals `value` synchronously. */
function reduceMotion(): void {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RingGauge', () => {
  it('renders 40 radial ticks, a track + sweep circle, and two labels', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={72} tier="HIGH" />);
    const svg = container.querySelector('svg.cp-ring')!;
    expect(svg.querySelectorAll('line')).toHaveLength(40);
    expect(svg.querySelectorAll('circle')).toHaveLength(2);
    expect(svg.querySelectorAll('text')).toHaveLength(2);
    unmount();
  });

  it('shows the value as the big number and the tier as the sub-label', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={72} tier="HIGH" />);
    const texts = container.querySelectorAll('text');
    expect(texts[0]!.textContent).toBe('72');
    expect(container.querySelector('.cp-ring__label')!.textContent).toBe('HIGH');
    unmount();
  });

  it('colors the sweep + label from the tier', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={72} tier="HIGH" />);
    const sweep = container.querySelector('.cp-ring__sweep')!;
    expect(sweep.getAttribute('stroke')).toBe(colors.warn);
    expect(sweep.getAttribute('stroke')).toBe(tierColor('HIGH'));
    expect(container.querySelector('.cp-ring__label')!.getAttribute('fill')).toBe(colors.warn);
    unmount();
  });

  it('reflects a different tier color', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={10} tier="LOW" />);
    expect(container.querySelector('.cp-ring__sweep')!.getAttribute('stroke')).toBe(colors.proof);
    unmount();
  });

  it('lights up ticks proportionally to the value', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={72} tier="HIGH" />);
    const lines = Array.from(container.querySelectorAll('line'));
    // fraction = 0.72 -> lit when i/40 <= 0.72 -> i in 0..28 -> 29 ticks.
    const lit = lines.filter((l) => l.getAttribute('stroke') === colors.warn);
    expect(lit).toHaveLength(29);
    unmount();
  });

  it('accepts a sub-label override (rendered uppercase)', () => {
    reduceMotion();
    const { container, unmount } = render(
      <RingGauge value={50} tier="MEDIUM" label="watch" />,
    );
    expect(container.querySelector('.cp-ring__label')!.textContent).toBe('WATCH');
    unmount();
  });

  it('exposes an accessible label', () => {
    reduceMotion();
    const { container, unmount } = render(<RingGauge value={88} tier="EXTREME" />);
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Risk score 88 of 100, EXTREME tier',
    );
    unmount();
  });

  it('animates the sweep across frames when motion is allowed', () => {
    let next = 0;
    const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      next += 1;
      queue.push({ id: next, cb });
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { container, unmount } = render(<RingGauge value={100} tier="EXTREME" />);
    const bigNumber = () => container.querySelectorAll('text')[0]!.textContent;

    expect(bigNumber()).toBe('0');

    // Mid-sweep: p=0.5 -> cubic-out 0.875 -> 87.5 -> "88"; another frame queued.
    act(() => {
      queue.splice(0, queue.length).forEach(({ cb }) => cb(800));
    });
    expect(bigNumber()).toBe('88');
    expect(queue.length).toBe(1);

    // Drive to the end of the 1600ms sweep.
    act(() => {
      queue.splice(0, queue.length).forEach(({ cb }) => cb(1600));
    });
    expect(bigNumber()).toBe('100');
    // All 40 ticks lit at fraction 1.
    const lit = Array.from(container.querySelectorAll('line')).filter(
      (l) => l.getAttribute('stroke') === colors.fail,
    );
    expect(lit).toHaveLength(40);
    unmount();
  });
});
