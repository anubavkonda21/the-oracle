import { hexToNumber, hexToRgba } from '../../utils/color';

/**
 * Design tokens — the TypeScript half of the design system.
 *
 * The same values are declared as CSS custom properties in
 * `src/styles/tokens.css`. Canvas code reads from here, DOM code reads the CSS,
 * and `tests/game/designTokens.test.ts` fails if the two ever drift apart.
 *
 * Palette progression across the game:
 *   classical   → background / text / border / surface
 *   uncertainty → signalRed (warnings, Oracle activity, measurement, anomalies)
 *   quantum     → quantumIndigo (reserved; unused until Quantum Mode exists)
 *
 * The `dark…` colours are a second, darker room — THE BOX. They replace the
 * classical four inside the dark stage environment and are used nowhere else.
 */
export const COLORS = {
  background: '#F1EFE9',
  textPrimary: '#111111',
  textSecondary: '#6F6D67',
  border: '#D2CEC5',
  surface: '#E9E6DF',
  machineBlack: '#171717',
  signalRed: '#B3262E',
  quantumIndigo: '#5146A8',
  darkBackground: '#171717',
  darkTextPrimary: '#F1EFE9',
  darkTextSecondary: '#A8A59E',
  darkBorder: '#5A5750',
} as const;

export type ColorToken = keyof typeof COLORS;

/** Human/UI typeface vs. machine typeface. The contrast between the two is deliberate. */
export const FONT_FAMILIES = {
  human: 'Inter',
  machine: 'JetBrains Mono',
} as const;

export const FONT_STACKS = {
  human: `'${FONT_FAMILIES.human}', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  machine: `'${FONT_FAMILIES.machine}', 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`,
} as const;

export const MOTION = {
  /** Hover / press feedback on controls. */
  controlMs: 180,
  /** One half of a scene transition: the stage fades out, then fades back in. */
  sceneFadeMs: 240,
} as const;

/** Name of the CSS custom property that mirrors a colour token, e.g. `--color-text-primary`. */
export function colorCssVariable(token: ColorToken): string {
  return `--color-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** Colour as a `0xRRGGBB` number, the form Phaser game objects expect. */
export function colorNumber(token: ColorToken): number {
  return hexToNumber(COLORS[token]);
}

/** Colour as an `rgba()` string, for Canvas 2D drawing. */
export function colorRgba(token: ColorToken, alpha = 1): string {
  return hexToRgba(COLORS[token], alpha);
}
