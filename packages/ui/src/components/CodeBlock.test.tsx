import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock.js';
import { click, flush, render } from '../test-utils.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CodeBlock', () => {
  it('renders code, a language label, and a copy button by default', () => {
    const { container, unmount } = render(
      <CodeBlock code="npm i @casperproof/ui" language="bash" />,
    );
    expect(container.querySelector('.cp-codeblock__code')!.textContent).toBe(
      'npm i @casperproof/ui',
    );
    expect(container.querySelector('.cp-codeblock__lang')!.textContent).toBe('bash');
    expect(container.querySelector('.cp-hash__copy')).not.toBeNull();
    unmount();
  });

  it('omits the language label and copy button when not requested', () => {
    const { container, unmount } = render(<CodeBlock code="x" copyable={false} />);
    expect(container.querySelector('.cp-codeblock__lang')).toBeNull();
    expect(container.querySelector('.cp-hash__copy')).toBeNull();
    unmount();
  });

  it('copies the code and flips the aria-label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, unmount } = render(<CodeBlock code="hello" />);
    const btn = container.querySelector('.cp-hash__copy')!;
    expect(btn.getAttribute('aria-label')).toBe('Copy code');

    click(btn);
    await flush();

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(btn.getAttribute('aria-label')).toBe('Copied');
    unmount();
  });

  it('keeps the copy label when the write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('nope'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { container, unmount } = render(<CodeBlock code="hello" />);
    const btn = container.querySelector('.cp-hash__copy')!;
    click(btn);
    await flush();

    expect(btn.getAttribute('aria-label')).toBe('Copy code');
    unmount();
  });

  it('no-ops when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const { container, unmount } = render(<CodeBlock code="hello" />);
    const btn = container.querySelector('.cp-hash__copy')!;
    click(btn);
    await flush();
    expect(btn.getAttribute('aria-label')).toBe('Copy code');
    unmount();
  });
});
