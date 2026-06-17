import { afterEach, describe, expect, it, vi } from 'vitest';
import { HashDisplay, truncateHash } from './HashDisplay.js';
import { click, flush, render } from '../test-utils.js';

const HASH64 = 'a'.repeat(20) + 'b'.repeat(20) + 'c'.repeat(24); // 64 chars

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('truncateHash', () => {
  it('truncates a long hash in the middle with an ellipsis', () => {
    expect(truncateHash(HASH64)).toBe('aaaaaa…cccccc');
  });

  it('honours custom lead/tail lengths', () => {
    expect(truncateHash(HASH64, 4, 2)).toBe('aaaa…cc');
  });

  it('returns short hashes unchanged (no benefit from truncating)', () => {
    expect(truncateHash('abcd')).toBe('abcd');
    // exactly at the boundary lead+tail+1
    expect(truncateHash('abcdefghijklm', 6, 6)).toBe('abcdefghijklm');
  });
});

describe('HashDisplay', () => {
  it('shows truncated text with the full value in title and prefix applied', () => {
    const { container, unmount } = render(<HashDisplay hash={HASH64} prefix="0x" />);
    const value = container.querySelector('.cp-hash__value')!;
    expect(value.textContent).toBe('0xaaaaaa…cccccc');
    expect(value.getAttribute('title')).toBe(`0x${HASH64}`);
    unmount();
  });

  it('omits the copy button when copyable=false', () => {
    const { container, unmount } = render(<HashDisplay hash={HASH64} copyable={false} />);
    expect(container.querySelector('.cp-hash__copy')).toBeNull();
    unmount();
  });

  it('copies the full value to the clipboard and flips the label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, unmount } = render(<HashDisplay hash={HASH64} />);
    const btn = container.querySelector('.cp-hash__copy')!;
    expect(btn.getAttribute('aria-label')).toBe(`Copy ${HASH64}`);

    click(btn);
    await flush();

    expect(writeText).toHaveBeenCalledWith(HASH64);
    expect(btn.getAttribute('aria-label')).toBe('Copied');
    unmount();
  });

  it('stays in the un-copied state when the clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, unmount } = render(<HashDisplay hash={HASH64} />);
    const btn = container.querySelector('.cp-hash__copy')!;
    click(btn);
    await flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute('aria-label')).toBe(`Copy ${HASH64}`);
    unmount();
  });

  it('no-ops when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const { container, unmount } = render(<HashDisplay hash={HASH64} />);
    const btn = container.querySelector('.cp-hash__copy')!;
    click(btn);
    await flush();
    expect(btn.getAttribute('aria-label')).toBe(`Copy ${HASH64}`);
    unmount();
  });
});
