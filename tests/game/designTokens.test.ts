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
    expect(colorNumber('signalRed')).toBe(0xe6483f);
    expect(colorNumber('machineBlack')).toBe(0x0d1015);
  });

  it('converts tokens to rgba() strings', () => {
    expect(colorRgba('textPrimary')).toBe('rgba(233, 237, 243, 1)');
    expect(colorRgba('signalRed', 0.5)).toBe('rgba(230, 72, 63, 0.5)');
  });
});

describe('design tokens: text contrast (WCAG AA is 4.5:1)', () => {
  it('primary text is clearly legible on the background and on panel surfaces', () => {
    expect(contrastRatio(COLORS.textPrimary, COLORS.background)).toBeGreaterThan(7);
    expect(contrastRatio(COLORS.textPrimary, COLORS.surface)).toBeGreaterThan(7);
  });

  it('secondary text clears AA on the background, with room to spare', () => {
    expect(contrastRatio(COLORS.textSecondary, COLORS.background)).toBeGreaterThan(6.5);
  });

  it('secondary text clears AA on panel surfaces too', () => {
    expect(contrastRatio(COLORS.textSecondary, COLORS.surface)).toBeGreaterThan(6.5);
  });

  it('both text colours of the dark room are clearly legible on its background', () => {
    expect(contrastRatio(COLORS.darkTextPrimary, COLORS.darkBackground)).toBeGreaterThan(7);
    expect(contrastRatio(COLORS.darkTextSecondary, COLORS.darkBackground)).toBeGreaterThan(7);
  });

  it('the signal red stays visible as a mark on the dark background, where it is never used for text', () => {
    expect(contrastRatio(COLORS.signalRed, COLORS.darkBackground)).toBeGreaterThan(2);
  });
});

describe('design tokens: the laboratory is a dark room', () => {
  it('uses the palette approved for the dark laboratory', () => {
    expect(COLORS.background).toBe('#0B0E13');
    expect(COLORS.textPrimary).toBe('#E9EDF3');
    expect(COLORS.textSecondary).toBe('#94A0B2');
    expect(COLORS.surface).toBe('#11151C');
    expect(COLORS.void).toBe('#06080B');
    expect(COLORS.instrument).toBe('#DDE7F4');
    expect(COLORS.signalRed).toBe('#E6483F');
    expect(COLORS.quantumIndigo).toBe('#7B6EF6');
    expect(COLORS.quantumBright).toBe('#A99FFF');
  });

  it('has one room: the old second room repeats the laboratory\'s four colours', () => {
    expect(COLORS.darkBackground).toBe(COLORS.background);
    expect(COLORS.darkTextPrimary).toBe(COLORS.textPrimary);
    expect(COLORS.darkTextSecondary).toBe(COLORS.textSecondary);
    expect(COLORS.darkBorder).toBe(COLORS.border);
  });

  it('is dark: the room is far darker than anything read or lit in it', () => {
    expect(contrastRatio(COLORS.background, COLORS.void)).toBeLessThan(1.1);
    for (const light of [COLORS.textPrimary, COLORS.instrument, COLORS.quantumBright]) {
      expect(contrastRatio(light, COLORS.background)).toBeGreaterThan(7);
    }
  });

  it('keeps the lines of its instruments visible without making them loud', () => {
    const lines = contrastRatio(COLORS.border, COLORS.background);
    expect(lines).toBeGreaterThan(1.8);
    expect(lines).toBeLessThan(3);
  });

  it('introduces no indigo: the dark environment only remaps the classical colours', () => {
    const darkBlock = /\.stage\[data-environment='dark'\]\s*\{([^}]*)\}/.exec(shellCss)?.[1] ?? '';
    expect(darkBlock).toContain('--color-background: var(--color-dark-background)');
    expect(darkBlock).toContain('--color-text-primary: var(--color-dark-text-primary)');
    expect(darkBlock).toContain('--color-text-secondary: var(--color-dark-text-secondary)');
    expect(darkBlock).toContain('--color-border: var(--color-dark-border)');
    expect(shellCss).not.toMatch(/quantum-indigo/);
  });
});
