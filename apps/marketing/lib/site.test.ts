import { describe, it, expect } from 'vitest';
import { stripTrailingSlash, absoluteUrl, SITE_URL, SOCIALS } from './site.js';

describe('stripTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(stripTrailingSlash('https://casperproof.com/')).toBe('https://casperproof.com');
  });

  it('leaves slash-free URLs unchanged', () => {
    expect(stripTrailingSlash('https://casperproof.com')).toBe('https://casperproof.com');
  });
});

describe('absoluteUrl', () => {
  it('returns the bare origin for an empty path', () => {
    expect(absoluteUrl()).toBe(SITE_URL);
    expect(absoluteUrl('')).toBe(SITE_URL);
  });

  it('joins paths with and without a leading slash', () => {
    expect(absoluteUrl('/og.svg')).toBe(`${SITE_URL}/og.svg`);
    expect(absoluteUrl('og.svg')).toBe(`${SITE_URL}/og.svg`);
  });

  it('produces non-localhost URLs by default', () => {
    expect(SITE_URL).not.toMatch(/localhost/);
    expect(absoluteUrl('/og.svg')).toMatch(/^https:\/\//);
  });
});

describe('socials', () => {
  it('are absolute https links', () => {
    expect(SOCIALS.twitter).toMatch(/^https:\/\//);
    expect(SOCIALS.github).toMatch(/^https:\/\//);
  });
});
