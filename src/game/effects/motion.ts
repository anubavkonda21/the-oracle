/** True when the player has asked their system to minimise motion. Checked at the moment of use, so it tracks live changes. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
