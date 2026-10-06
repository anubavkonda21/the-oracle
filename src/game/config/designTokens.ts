import { hexToNumber, hexToRgba } from '../../utils/color';

/**
 * Design tokens — the TypeScript half of the design system.
 *
 * The same values are declared as CSS custom properties in
 * `src/styles/tokens.css`. Canvas code reads from here, DOM code reads the CSS,
 * and `tests/game/designTokens.test.ts` fails if the two ever drift apart.
 *
 * The laboratory is a dark room, and light in it means something:
 *   the room    → background / text / border / surface, and `void` beyond them
 *   classical   → instrument (cool white: what has been asked, and answered)
 *   activity    → signalRed (machine activity, warnings, anomalies)
 *   quantum     → quantumIndigo / quantumBright (seen nowhere until Quantum Mode)
 *
 * The `dark…` colours belonged to a second room of the earlier, paper-coloured
 * game. They now repeat the room's four, and stay until the interface is rebuilt.
 */
export const COLORS = {
  background: '#0B0E13',
  textPrimary: '#E9EDF3',
  textSecondary: '#94A0B2',
  border: '#3D4757',
  surface: '#11151C',
  void: '#06080B',
  machineBlack: '#0D1015',
  instrument: '#DDE7F4',
  signalRed: '#E6483F',
  quantumIndigo: '#7B6EF6',
  quantumBright: '#A99FFF',
  darkBackground: '#0B0E13',
  darkTextPrimary: '#E9EDF3',
  darkTextSecondary: '#94A0B2',
  darkBorder: '#3D4757',
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
