import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import {
  COLORS,
  FONT_STACKS,
  MOTION,
  colorCssVariable,
  colorNumber,
  colorRgba,
  type ColorToken,
} from '../../src/game/config/designTokens';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/game/config/display';
import { COMPACT_VIEWPORT_QUERY } from '../../src/game/systems/desktopGate';
import shellCss from '../../src/styles/shell.css?raw';
import tokensCss from '../../src/styles/tokens.css?raw';
import { contrastRatio } from '../../src/utils/color';

/** Custom properties declared in the first `:root` block of a stylesheet (i.e. the defaults, not media-query overrides). */
function readRootDeclarations(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';

  const declarations = new Map<string, string>();
  for (const [, name, value] of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) {
      declarations.set(name, value.trim().replace(/\s+/g, ' '));
    }
  }
  return declarations;
}

const cssTokens = readRootDeclarations(tokensCss);
const colorTokens = Object.keys(COLORS) as ColorToken[];

describe('design tokens: TypeScript and CSS stay in sync', () => {
  it.each(colorTokens)('colour "%s" has the same value in tokens.css', (token) => {
    expect(cssTokens.get(colorCssVariable(token))?.toUpperCase()).toBe(COLORS[token].toUpperCase());
  });

  it('declares no colour in CSS that is missing from TypeScript', () => {
    const cssColorNames = [...cssTokens.keys()].filter((name) => name.startsWith('--color-')).sort();
    expect(cssColorNames).toEqual(colorTokens.map(colorCssVariable).sort());
  });

  it('uses the same font stacks', () => {
    expect(cssTokens.get('--font-human')).toBe(FONT_STACKS.human);
    expect(cssTokens.get('--font-machine')).toBe(FONT_STACKS.machine);
  });

  it('uses the same motion timings', () => {
    expect(cssTokens.get('--motion-control')).toBe(`${MOTION.controlMs}ms`);
    expect(cssTokens.get('--motion-scene-fade')).toBe(`${MOTION.sceneFadeMs}ms`);
  });

  it('derives the CSS stage unit from the design resolution', () => {
    expect(cssTokens.get('--u')).toBe(`min(100vw / ${DESIGN_WIDTH}, 100vh / ${DESIGN_HEIGHT})`);
  });

  it('hides the game at the same breakpoint in CSS as in the desktop gate', () => {
    expect(shellCss).toContain(`@media ${COMPACT_VIEWPORT_QUERY}`);
  });

  it('gives the browser chrome the background colour', () => {
    expect(indexHtml).toContain(`<meta name="theme-color" content="${COLORS.background}" />`);
  });
});

describe('design tokens: motion', () => {
  it('keeps control feedback within 150–220ms', () => {
    expect(MOTION.controlMs).toBeGreaterThanOrEqual(150);
    expect(MOTION.controlMs).toBeLessThanOrEqual(220);
  });

  it('keeps a full scene transition (fade out + fade in) within 300–600ms', () => {
    const transitionMs = MOTION.sceneFadeMs * 2;
    expect(transitionMs).toBeGreaterThanOrEqual(300);
    expect(transitionMs).toBeLessThanOrEqual(600);
  });
});

describe('design tokens: colour helpers', () => {
  it('names CSS variables in kebab-case', () => {
    expect(colorCssVariable('background')).toBe('--color-background');
    expect(colorCssVariable('textPrimary')).toBe('--color-text-primary');
    expect(colorCssVariable('quantumIndigo')).toBe('--color-quantum-indigo');
  });

  it('converts tokens to Phaser colour numbers', () => {
    expect(colorNumber('signalRed')).toBe(0xb3262e);
    expect(colorNumber('machineBlack')).toBe(0x171717);
  });

  it('converts tokens to rgba() strings', () => {
    expect(colorRgba('textPrimary')).toBe('rgba(17, 17, 17, 1)');
    expect(colorRgba('signalRed', 0.5)).toBe('rgba(179, 38, 46, 0.5)');
  });
});

describe('design tokens: text contrast (WCAG AA is 4.5:1)', () => {
  it('primary text is clearly legible on the background and on panel surfaces', () => {
    expect(contrastRatio(COLORS.textPrimary, COLORS.background)).toBeGreaterThan(7);
    expect(contrastRatio(COLORS.textPrimary, COLORS.surface)).toBeGreaterThan(7);
  });

  it('secondary text sits at the AA threshold on the background', () => {
    // The specified pair measures 4.4992:1 — 4.50:1 as usually quoted, but a hair under a strict 4.5.
    // This guards against it getting any worse; see "Known limits" in the README.
    expect(contrastRatio(COLORS.textSecondary, COLORS.background)).toBeCloseTo(4.5, 2);
  });

  it('secondary text does not meet AA on panel surfaces, which is why panels use primary text', () => {
    expect(contrastRatio(COLORS.textSecondary, COLORS.surface)).toBeLessThan(4.5);
  });
});
