/**
 * Motion utilities shared by the animated primitives.
 *
 * Every RAF/CSS-driven primitive honours the user's `prefers-reduced-motion`
 * setting by jumping straight to its final state. This helper centralises the
 * detection so the behaviour is identical everywhere and SSR/jsdom-safe.
 */

/**
 * `true` when the user (or OS) has requested reduced motion.
 *
 * Safe to call during SSR or in environments without `matchMedia` — it returns
 * `false` (motion allowed) rather than throwing.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
