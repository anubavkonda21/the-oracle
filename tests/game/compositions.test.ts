import { describe, expect, it } from 'vitest';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/game/config/display';
import { MACHINE_CENTER_Y } from '../../src/game/config/oracleConfig';
import { MACHINE } from '../../src/game/entities/oracleMachineLayout';
import { MACHINE_AT, MACHINE_BOUNDS, MACHINE_FOOT_Y, ROOM } from '../../src/game/world/roomLayout';
import indexHtml from '../../index.html?raw';
import componentsCss from '../../src/styles/components.css?raw';
import compositionsCss from '../../src/styles/compositions.css?raw';
import globalCss from '../../src/styles/global.css?raw';
import oracleCss from '../../src/styles/oracle.css?raw';
import tokensCss from '../../src/styles/tokens.css?raw';
import viewsCss from '../../src/styles/views.css?raw';

/**
 * The interface has three compositions — a wide window, a phone on its side
 * and a phone upright — and the shape of the window chooses between them (see
 * compositions.css). The room and the machine are on the canvas; these tests
 * are about where the words and controls go around them.
 *
 * The stylesheets cannot be run here, so the arithmetic in them is: the
 * custom properties that place the machine and the desk are read out of the
 * CSS and worked out for real screen sizes. What is checked is what a person
 * would see — that the machine is on the screen, that nothing lies over it,
 * that there is room for what has to fit.
 */

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return entry[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
};

/* ---------- Reading the stylesheets ---------- */

interface MediaBlock {
  readonly query: string;
  readonly body: string;
}

/** The top-level `@media` blocks of a stylesheet, in order. */
function mediaBlocks(css: string): MediaBlock[] {
  const source = withoutComments(css);
  const blocks: MediaBlock[] = [];
  const opening = /@media\s+([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(source))) {
    let depth = 1;
    let index = opening.lastIndex;
    while (depth > 0 && index < source.length) {
      const character = source[index];
      depth += character === '{' ? 1 : character === '}' ? -1 : 0;
      index += 1;
    }
    blocks.push({ query: (match[1] ?? '').trim(), body: source.slice(opening.lastIndex, index - 1) });
    opening.lastIndex = index; // Blocks nested inside this one are part of it, not blocks of their own.
  }
  return blocks;
}

/** A list of selectors, split at its commas — but not at a comma inside the brackets of one of them. */
function selectorsOf(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (character === ',' && depth === 0) {
      selectors.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  return [...selectors, current].map((selector) => selector.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** The parts of a value that are separated by spaces — but not by a space inside the brackets of one of them. */
function spaced(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (character === ' ' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  return [...parts, current].filter(Boolean);
}

/** The declarations of every rule that names exactly this selector, alone or in a list, in the order they are written. */
function ruleOf(css: string, selector: string): string {
  const declarations = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((rule) => selectorsOf(rule[1] ?? '').includes(selector))
    .map((rule) => rule[2] ?? '');
  if (declarations.length === 0) {
    throw new Error(`No rule for ${selector}.`);
  }
  return declarations.join('\n');
}

/** The value a selector's rules give a property: the last one written, which is the one that holds. */
function valueOf(css: string, selector: string, property: string): string {
  const declarations = [...ruleOf(css, selector).matchAll(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+);`, 'g'))];
  const value = declarations.at(-1)?.[1];
  if (value === undefined) {
    throw new Error(`${selector} does not set ${property}.`);
  }
  return value.trim();
}

/** Every custom property a block of declarations sets. */
function customProperties(declarations: string): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const [, name, value] of declarations.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) {
      properties[name] = value.trim();
    }
  }
  return properties;
}

/* ---------- Working out a CSS length ---------- */

interface Screen {
  readonly width: number;
  readonly height: number;
  /** The parts of the screen a phone keeps for itself, in CSS pixels. */
  readonly safe?: { top?: number; right?: number; bottom?: number; left?: number };
}

/**
 * Works out a CSS length, in pixels, on a screen: calc(), min(), max(),
 * clamp(), var() and env(), with the units the compositions use. `percentOf`
 * is what a percentage is a percentage of.
 */
function lengthOf(expression: string, screen: Screen, properties: Record<string, string>, percentOf = Number.NaN): number {
  const tokens = expression.match(/--[\w-]+|[a-z][\w-]*|\d*\.?\d+(?:[a-z%]+)?|[()+\-*/,]/gi) ?? [];
  let position = 0;

  const next = (): string => tokens[position++] ?? '';
  const peek = (): string => tokens[position] ?? '';
  const expect_ = (token: string): void => {
    if (next() !== token) {
      throw new Error(`Expected ${token} in "${expression}".`);
    }
  };

  const unit: Record<string, number> = {
    '': 1,
    px: 1,
    cqw: screen.width / 100,
    cqh: screen.height / 100,
    cqmin: Math.min(screen.width, screen.height) / 100,
    vw: screen.width / 100,
    vh: screen.height / 100,
    '%': percentOf / 100,
  };

  function args(): number[] {
    const values: number[] = [];
    expect_('(');
    do {
      values.push(sum());
    } while (peek() === ',' && next());
    expect_(')');
    return values;
  }

  function factor(): number {
    const token = next();
    if (token === '-') {
      return -factor();
    }
    if (token === '(') {
      const value = sum();
      expect_(')');
      return value;
    }
    if (/^\d|^\./.test(token)) {
      const [, digits = '', suffix = ''] = /^([\d.]+)(.*)$/.exec(token) ?? [];
      const scale = unit[suffix];
      if (scale === undefined) {
        throw new Error(`Unknown unit "${suffix}" in "${expression}".`);
      }
      return Number(digits) * scale;
    }
    switch (token) {
      case 'calc':
        return args()[0] ?? Number.NaN;
      case 'min':
        return Math.min(...args());
      case 'max':
        return Math.max(...args());
      case 'clamp': {
        const [least = 0, preferred = 0, most = 0] = args();
        return Math.max(least, Math.min(preferred, most));
      }
      case 'var': {
        expect_('(');
        const name = next();
        expect_(')');
        const value = properties[name];
        if (value === undefined) {
          throw new Error(`${name} is not defined, in "${expression}".`);
        }
        return lengthOf(value, screen, properties, percentOf);
      }
      case 'env': {
        expect_('(');
        const name = next();
        // The fallback is read past, not used: the screen says what its insets are.
        while (peek() !== ')') {
          next();
        }
        expect_(')');
        const side = /^safe-area-inset-(top|right|bottom|left)$/.exec(name)?.[1] as 'top' | 'right' | 'bottom' | 'left' | undefined;
        if (!side) {
          throw new Error(`Unknown environment variable ${name}.`);
        }
        return screen.safe?.[side] ?? 0;
      }
      default:
        throw new Error(`Cannot read "${token}" in "${expression}".`);
    }
  }

  function product(): number {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      value = next() === '*' ? value * factor() : value / factor();
    }
    return value;
  }

  function sum(): number {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      value = next() === '+' ? value + product() : value - product();
    }
    return value;
  }

  const result = sum();
  if (position !== tokens.length) {
    throw new Error(`Could not read all of "${expression}".`);
  }
  return result;
}

/** Whether a media query — of the kind the compositions are chosen by — applies to a screen. */
function applies(query: string, { width, height }: Screen): boolean {
  return query.split(',').some((alternative) =>
    alternative
      .trim()
      .split(/\s+and\s+/)
      .every((condition) => {
        const orientation = /^\(orientation:\s*(portrait|landscape)\)$/.exec(condition);
        if (orientation) {
          return (height >= width ? 'portrait' : 'landscape') === orientation[1];
        }
        const range = /^\((width|height)\s*(<=|>)\s*(\d+)px\)$/.exec(condition);
        if (range) {
          const size = range[1] === 'width' ? width : height;
          return range[2] === '>' ? size > Number(range[3]) : size <= Number(range[3]);
        }
        throw new Error(`Cannot read the media condition "${condition}".`);
      }),
  );
}

/* ---------- The stylesheets under test ---------- */

// The first `:root` block of the tokens is the one that holds everywhere; the second only adjusts motion.
const tokens = customProperties(/:root\s*\{([^}]*)\}/.exec(withoutComments(tokensCss))?.[1] ?? '');
const blocks = mediaBlocks(compositionsCss);
const [wide, phone, portrait, landscape] = blocks as [MediaBlock, MediaBlock, MediaBlock, MediaBlock];

const propertiesIn = (...composition: MediaBlock[]): Record<string, string> =>
  Object.assign({}, tokens, ...composition.map((block) => customProperties(ruleOf(block.body, ':root'))));

const PORTRAIT_PHONES: Screen[] = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 360, height: 840 },
  // The same, on phones that keep a notch at the top and a bar at the foot for themselves.
  { width: 375, height: 812, safe: { top: 44, bottom: 34 } },
  { width: 390, height: 844, safe: { top: 47, bottom: 34 } },
  { width: 430, height: 932, safe: { top: 59, bottom: 34 } },
  // And upright tablets, which are laid out the same way.
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
];

const LANDSCAPE_PHONES: Screen[] = [
  { width: 812, height: 375 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
  { width: 568, height: 320 },
  { width: 640, height: 360 },
  { width: 667, height: 375 },
  { width: 932, height: 430 },
  { width: 812, height: 375, safe: { left: 44, right: 44, bottom: 21 } },
  { width: 844, height: 390, safe: { left: 47, right: 47, bottom: 21 } },
  { width: 932, height: 430, safe: { left: 59, right: 59, bottom: 21 } },
  // A small landscape window on a desktop is laid out the same way: one too narrow for the wide composition…
  { width: 860, height: 700 },
  { width: 700, height: 500 },
  { width: 600, height: 375 },
  // …or too short for it, however wide.
  { width: 1000, height: 561 },
  { width: 1280, height: 600 },
  { width: 1600, height: 570 },
];

const WIDE_SCREENS: Screen[] = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 2560, height: 1080 },
];

const label = ({ width, height, safe }: Screen): string => `${width}×${height}${safe ? ' with safe areas' : ''}`;

/** How tall a line of the header's text is, near enough: its type is 11 to 14 pixels. */
const HEADER_LINE = 14;

/* ---------- Tests ---------- */

describe('the compositions and the canvas agree about the stage', () => {
  it('has the design frame the canvas is drawn in', () => {
    expect(Number(tokens['--design-width'])).toBe(DESIGN_WIDTH);
    expect(Number(tokens['--design-height'])).toBe(DESIGN_HEIGHT);
  });

  it('has the machine where the room puts it', () => {
    expect(Number(tokens['--machine-design-x'])).toBe(MACHINE_AT.x);
    expect(Number(tokens['--machine-design-y'])).toBe(MACHINE_AT.y);
    expect(Number(tokens['--machine-offset-y'])).toBe(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2);
  });

  it('is loaded after everything it arranges', () => {
    const imports = [...globalCss.matchAll(/@import '\.\/([\w-]+)\.css';/g)].map((match) => match[1]);
    expect(imports.at(-1)).toBe('compositions');
    expect(imports.indexOf('views')).toBeLessThan(imports.indexOf('compositions'));
  });
});

describe('the shape of the window chooses one composition', () => {
  it('has a wide composition, what the two phone compositions share, and the two of them', () => {
    expect(blocks).toHaveLength(4);
  });

  it('gives every window exactly one of the three', () => {
    for (let width = 280; width <= 2600; width += 20) {
      for (let height = 280; height <= 1700; height += 20) {
        const screen = { width, height };
        const chosen = [wide, portrait, landscape].filter((block) => applies(block.query, screen));
        expect(chosen, `${width}×${height}`).toHaveLength(1);
        // What the two phone compositions share applies to both of them, and to nothing else.
        expect(applies(phone.query, screen), `${width}×${height}`).toBe(chosen[0] !== wide);
      }
    }
  });

  it('does not use the wide composition in a window too small for it', () => {
    // Its panels have a floor on their size: below about 880 across they meet the machine, and below about 575 high each other.
    for (const screen of [
      { width: 880, height: 700 },
      { width: 1000, height: 561 },
      { width: 1200, height: 565 },
      { width: 1600, height: 570 },
      { width: 1920, height: 600 },
    ]) {
      expect(applies(wide.query, screen), label(screen)).toBe(false);
      expect(applies(landscape.query, screen), label(screen)).toBe(true);
    }
    for (const screen of [
      { width: 881, height: 601 },
      { width: 1024, height: 640 },
      { width: 1366, height: 650 },
    ]) {
      expect(applies(wide.query, screen), label(screen)).toBe(true);
    }
  });

  it('lays a desktop or laptop out wide, a phone on its side in landscape, and a phone upright in portrait', () => {
    for (const screen of WIDE_SCREENS) {
      expect(applies(wide.query, screen), label(screen)).toBe(true);
    }
    for (const screen of LANDSCAPE_PHONES) {
      expect(applies(landscape.query, screen), label(screen)).toBe(true);
    }
    for (const screen of PORTRAIT_PHONES) {
      expect(applies(portrait.query, screen), label(screen)).toBe(true);
    }
  });
});

describe('wide: the whole room, with the interface at its edges and beneath the machine', () => {
  const properties = propertiesIn();
  const frame = (screen: Screen): { width: number; height: number; u: number } => ({
    width: lengthOf(valueOf(wide.body, '.view', 'width'), screen, properties, screen.width),
    height: lengthOf(valueOf(wide.body, '.view', 'height'), screen, properties, screen.height),
    u: lengthOf('var(--u)', screen, properties),
  });

  it('lays the interface out over the whole window at 16:10 and 16:9', () => {
    for (const screen of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      expect(frame(screen).width, label(screen)).toBeCloseTo(screen.width, 6);
      expect(frame(screen).height, label(screen)).toBeCloseTo(screen.height, 6);
    }
  });

  it('keeps the interface with the room in a very wide or very tall window, instead of out at the edges of the screen', () => {
    const ultrawide = frame({ width: 2560, height: 1080 });
    expect(ultrawide.width).toBeLessThan(2560);
    // No further than a 16:9 frame around the stage: the room is still behind everything.
    expect(ultrawide.width / ultrawide.u).toBeLessThanOrEqual(DESIGN_HEIGHT * (16 / 9) + 1e-6);

    const tall = frame({ width: 1100, height: 1000 });
    expect(tall.height).toBeLessThan(1000);
    expect(tall.height / tall.u).toBeLessThan(DESIGN_HEIGHT * 1.15);
  });

  it('starts everything that is set beneath the machine clear of the platform it stands on', () => {
    // In stage units below the machine's centre. The dais ends a little below the foot.
    const platformEnds = MACHINE_FOOT_Y - MACHINE_AT.y + 38;
    for (const selector of ['.main-menu__desk', '.q-explanation', '.reveal__desk', '.credits__desk']) {
      const below = /\(var\(--machine-offset-y\) \+ (\d+)\) \* var\(--u\)/.exec(valueOf(wide.body, selector, 'top'));
      expect(Number(below?.[1]), selector).toBeGreaterThanOrEqual(platformEnds);
    }
    // The console is the one thing that is part of the platform: it starts at the machine's foot.
    const consoleTop = /\(var\(--machine-offset-y\) \+ (\d+)\) \* var\(--u\)/.exec(valueOf(wide.body, '.laboratory__console', 'top'));
    expect(Number(consoleTop?.[1])).toBeGreaterThan(MACHINE_FOOT_Y - MACHINE_AT.y);
  });

  it('starts the panels at either side level with the top of the machine, and what is above the machine above it', () => {
    const top = MACHINE_BOUNDS.y - MACHINE_AT.y; // −150
    for (const selector of ['.laboratory__space', '.q-sequence']) {
      const offset = /\(var\(--machine-offset-y\) - (\d+)\) \* var\(--u\)/.exec(valueOf(wide.body, selector, 'top'));
      expect(-Number(offset?.[1]), selector).toBe(top);
    }
    for (const selector of ['.laboratory__constraint', '.q-stage']) {
      const offset = /50% - \(var\(--machine-offset-y\) - (\d+)\) \* var\(--u\)/.exec(valueOf(wide.body, selector, 'bottom'));
      expect(-Number(offset?.[1]), selector).toBeLessThan(top);
    }
  });

  it('stops the objective short of the controls beside it, in a small window as in a large one', () => {
    // The two controls in the middle are 358 pixels across at their smallest (their type has a floor), however small the stage.
    const HALF_THE_CONTROLS = 358 / 2;
    const maxWidth = valueOf(wide.body, '.laboratory__brief', 'max-width');
    for (const screen of [
      { width: 881, height: 601 },
      { width: 1024, height: 640 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
    ]) {
      const { width, u } = frame(screen);
      const edge = lengthOf('var(--edge-x)', screen, properties);
      // From the middle of the frame back to where the objective can reach at its widest.
      const clear = width / 2 - edge - lengthOf(maxWidth, screen, properties, width);
      expect(clear, label(screen)).toBeGreaterThan(HALF_THE_CONTROLS);
      expect(clear, label(screen)).toBeGreaterThanOrEqual(250 * u - 1e-6);
    }
  });

  it('places the laboratory’s and Quantum Mode’s parts one by one: their desk is a grouping for a phone', () => {
    expect(wide.body).toMatch(/\.laboratory__desk,\s*\.laboratory__record\s*\{\s*display:\s*contents;\s*\}/);
    expect(wide.body).toMatch(/\.q-desk,\s*\.q-body\s*\{\s*display:\s*contents;\s*\}/);
  });
});

describe('phone: the room is framed on the machine, and the interface is sized for a hand', () => {
  it('fits the canvas to a frame placed so the machine is where the composition wants it', () => {
    const canvas = ruleOf(phone.body, '.stage__canvas');
    expect(canvas).toMatch(/top:\s*calc\(var\(--machine-y\) - var\(--machine-design-y\) \* var\(--stage-u\)\);/);
    expect(canvas).toMatch(/left:\s*calc\(var\(--machine-x\) - var\(--machine-design-x\) \* var\(--stage-u\)\);/);
    expect(canvas).toMatch(/width:\s*calc\(var\(--design-width\) \* var\(--stage-u\)\);/);
    expect(canvas).toMatch(/height:\s*calc\(var\(--design-height\) \* var\(--stage-u\)\);/);
  });

  it('sizes the interface to be read, not to match the canvas', () => {
    for (const screen of [...PORTRAIT_PHONES, ...LANDSCAPE_PHONES]) {
      const u = lengthOf('var(--u)', screen, propertiesIn(phone));
      expect(u, label(screen)).toBeGreaterThanOrEqual(0.8);
      expect(u, label(screen)).toBeLessThanOrEqual(1);
    }
  });

  it('makes every control big enough for a finger', () => {
    expect(lengthOf(valueOf(phone.body, '.control', 'min-height'), { width: 375, height: 812 }, tokens)).toBeGreaterThanOrEqual(44);
    expect(lengthOf(valueOf(phone.body, '.main-menu__action .control', 'min-height'), { width: 375, height: 812 }, tokens)).toBeGreaterThanOrEqual(44);
    expect(lengthOf(valueOf(portrait.body, '.bit', 'height'), { width: 375, height: 812 }, tokens)).toBeGreaterThanOrEqual(44);
    expect(lengthOf(valueOf(landscape.body, '.bit', 'height'), { width: 812, height: 375 }, tokens)).toBeGreaterThanOrEqual(44);
    // The pair of choices inside the log is smaller than the other controls in a wide window. Not here.
    expect(lengthOf(valueOf(phone.body, '.control--compact', 'min-height'), { width: 375, height: 812 }, tokens)).toBeGreaterThanOrEqual(44);
  });

  it('makes each of the six bits a finger wide, upright', () => {
    const narrowest = mediaBlocks(portrait.body).find((block) => block.query === '(width <= 340px)');
    for (const screen of PORTRAIT_PHONES) {
      const properties = propertiesIn(phone, portrait);
      const desk = lengthOf(valueOf(portrait.body, '.view__desk', 'width'), screen, properties, screen.width);
      const gap = lengthOf(
        screen.width <= 340 ? valueOf(narrowest?.body ?? '', '.bit-input', 'gap') : valueOf(phone.body, '.bit-input', 'gap'),
        screen,
        properties,
      );
      // The six share the width of the desk between them.
      expect((desk - 5 * gap) / 6, label(screen)).toBeGreaterThanOrEqual(44);
    }
    expect(ruleOf(phone.body, '.bit')).toMatch(/flex:\s*1 1 0;/);
  });

  it('makes each of the six bits a finger wide on its side too, with the control to ask beside them or beneath', () => {
    const basis = /^\d+ \d+ (.+)$/.exec(valueOf(landscape.body, '.bit-input', 'flex'))?.[1] ?? '';
    for (const screen of LANDSCAPE_PHONES) {
      const properties = propertiesIn(phone, landscape);
      const gap = lengthOf(valueOf(landscape.body, '.bit-input', 'gap'), screen, properties);
      const row = lengthOf(basis, screen, properties);
      // The room the row of bits asks for is six fingers and the spaces between them…
      expect((row - 5 * gap) / 6, label(screen)).toBeGreaterThanOrEqual(44);

      // …and the desk always has that much, inside its padding, so the row is never squeezed.
      const [, right = '', , left = ''] = spaced(valueOf(landscape.body, '.view__desk', 'padding'));
      const inside = lengthOf('var(--desk-width)', screen, properties) - lengthOf(left, screen, properties) - lengthOf(right, screen, properties);
      expect(inside, label(screen)).toBeGreaterThanOrEqual(row);

      // On a phone of an ordinary size there is room for the control beside them (it is 57 pixels wide, with 8 between).
      if (screen.width >= 812 && !screen.safe) {
        expect(inside - row, label(screen)).toBeGreaterThanOrEqual(57 + 8);
      }
    }
    // If the control to ask does not fit beside the row, it wraps beneath it; the bits do not give way.
    const console_ = ruleOf(landscape.body, '.console');
    expect(console_).toMatch(/display:\s*flex;/);
    expect(console_).toMatch(/flex-wrap:\s*wrap;/);
  });

  it('lets what there is to read scroll, and keeps what there is to do in place', () => {
    const body = ruleOf(phone.body, '.view__body');
    expect(body).toMatch(/overflow-y:\s*auto;/);
    expect(body).toMatch(/min-height:\s*0;/);
    // The interface layer passes pointer input through to nothing but its controls; a region that scrolls has to take it.
    expect(body).toMatch(/pointer-events:\s*auto;/);
    expect(ruleOf(phone.body, '.view__actions')).toMatch(/flex:\s*none;/);
    expect(ruleOf(phone.body, '.view__desk')).toMatch(/flex-direction:\s*column;/);
  });

  it('never scrolls sideways: nothing in a phone composition is given a fixed width wider than a phone', () => {
    for (const block of [phone, portrait, landscape]) {
      for (const [, pixels] of block.body.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)) {
        expect(Number(pixels)).toBeLessThanOrEqual(320);
      }
    }
    expect(ruleOf(phone.body, '.panel')).toMatch(/min-width:\s*0;/);
  });

  it('keeps clear of a notch and of the bar at the foot of the screen', () => {
    expect(indexHtml).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*"/);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(tokens[`--safe-${side}`]).toBe(`env(safe-area-inset-${side}, 0px)`);
    }
    expect(valueOf(portrait.body, '.view__header', 'top')).toMatch(/var\(--safe-top\)/);
    expect(valueOf(portrait.body, '.view__desk', 'padding-bottom')).toMatch(/var\(--safe-bottom\)/);
    expect(valueOf(landscape.body, '.view__header', 'left')).toMatch(/var\(--safe-left\)/);
    const deskPadding = valueOf(landscape.body, '.view__desk', 'padding');
    expect(deskPadding).toMatch(/var\(--safe-top\)/);
    expect(deskPadding).toMatch(/var\(--safe-right\)/);
    expect(deskPadding).toMatch(/var\(--safe-bottom\)/);
  });
});

describe('phone portrait: the machine at the top, the desk beneath it', () => {
  const geometry = (screen: Screen) => {
    const properties = propertiesIn(phone, portrait);
    const scale = lengthOf('var(--stage-u)', screen, properties);
    const machineX = lengthOf('var(--machine-x)', screen, properties);
    const machineY = lengthOf('var(--machine-y)', screen, properties);
    return {
      scale,
      machine: {
        left: machineX - (MACHINE.width / 2) * scale,
        right: machineX + (MACHINE.width / 2) * scale,
        top: machineY + (MACHINE_BOUNDS.y - MACHINE_AT.y) * scale,
        foot: machineY + (MACHINE_FOOT_Y - MACHINE_AT.y) * scale,
      },
      canvas: {
        left: machineX - MACHINE_AT.x * scale,
        right: machineX + (DESIGN_WIDTH - MACHINE_AT.x) * scale,
        top: machineY - MACHINE_AT.y * scale,
      },
      deskTop: lengthOf('var(--desk-top)', screen, properties),
      headerTop: lengthOf(valueOf(portrait.body, '.view__header', 'top'), screen, properties),
      deskFoot: screen.height - lengthOf(valueOf(portrait.body, '.view__desk', 'padding-bottom'), screen, properties),
    };
  };

  it('shows the whole machine, in the middle of the screen, at a size worth looking at', () => {
    for (const screen of PORTRAIT_PHONES) {
      const { machine } = geometry(screen);
      expect(machine.left, label(screen)).toBeGreaterThan(0);
      expect(machine.right, label(screen)).toBeLessThan(screen.width);
      expect((machine.left + machine.right) / 2, label(screen)).toBeCloseTo(screen.width / 2, 6);
      // Never the thumbnail it was when the whole room was squeezed into the width of a phone (a third of the width).
      expect(machine.right - machine.left, label(screen)).toBeGreaterThan(Math.min(screen.width * 0.5, 300));
      // Nor so large that nothing of the room is left beside it, however tall and narrow the screen.
      expect(machine.right - machine.left, label(screen)).toBeLessThanOrEqual((screen.width * 2) / 3 + 0.5);
    }
  });

  it('fills the width of the screen with the room, from the top of the screen down', () => {
    for (const screen of PORTRAIT_PHONES) {
      const { canvas } = geometry(screen);
      expect(canvas.left, label(screen)).toBeLessThanOrEqual(0);
      expect(canvas.right, label(screen)).toBeGreaterThanOrEqual(screen.width);
      expect(canvas.top, label(screen)).toBeLessThanOrEqual(0);
    }
  });

  it('frames the room below the ceiling’s light fittings, so the header is not read against a lamp', () => {
    const { key, fillLeft, fillRight } = ROOM.fixtures;
    for (const screen of PORTRAIT_PHONES) {
      const { canvas, scale } = geometry(screen);
      for (const fixture of [key, fillLeft, fillRight]) {
        expect(canvas.top + (fixture.y + fixture.height) * scale, label(screen)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('puts the header above the machine and the desk below it, with neither over it', () => {
    for (const screen of PORTRAIT_PHONES) {
      const { machine, headerTop, deskTop } = geometry(screen);
      expect(headerTop + HEADER_LINE, label(screen)).toBeLessThanOrEqual(machine.top);
      expect(headerTop, label(screen)).toBeGreaterThanOrEqual(screen.safe?.top ?? 0);
      expect(deskTop, label(screen)).toBeGreaterThanOrEqual(machine.foot);
    }
  });

  it('leaves the desk the greater part of the screen', () => {
    for (const screen of PORTRAIT_PHONES) {
      const { deskTop, deskFoot } = geometry(screen);
      expect(deskFoot - deskTop, label(screen)).toBeGreaterThan(screen.height * 0.55);
      expect(deskFoot, label(screen)).toBeLessThanOrEqual(screen.height - (screen.safe?.bottom ?? 0));
    }
  });

  it('lets the room fade into the page where it ends, part-way down the screen', () => {
    expect(ruleOf(portrait.body, '.stage__canvas')).toMatch(/mask-image:\s*linear-gradient\(to bottom, #000 \d+%, transparent 100%\);/);
  });

  it('does not let the desk spread across an upright tablet', () => {
    const width = valueOf(portrait.body, '.view__desk', 'width');
    expect(lengthOf(width, { width: 375, height: 812 }, propertiesIn(phone, portrait), 375)).toBeCloseTo(375 - 32, 6);
    expect(lengthOf(width, { width: 820, height: 1180 }, propertiesIn(phone, portrait), 820)).toBeLessThanOrEqual(560);
  });
});

describe('phone landscape: the machine to the left, the desk beside it', () => {
  const geometry = (screen: Screen) => {
    const properties = propertiesIn(phone, landscape);
    const scale = lengthOf('var(--stage-u)', screen, properties);
    const machineX = lengthOf('var(--machine-x)', screen, properties);
    const machineY = lengthOf('var(--machine-y)', screen, properties);
    return {
      scale,
      machine: {
        left: machineX - (MACHINE.width / 2) * scale,
        right: machineX + (MACHINE.width / 2) * scale,
        top: machineY + (MACHINE_BOUNDS.y - MACHINE_AT.y) * scale,
        foot: machineY + (MACHINE_FOOT_Y - MACHINE_AT.y) * scale,
      },
      canvas: {
        left: machineX - MACHINE_AT.x * scale,
        right: machineX + (DESIGN_WIDTH - MACHINE_AT.x) * scale,
        top: machineY - MACHINE_AT.y * scale,
        bottom: machineY + (DESIGN_HEIGHT - MACHINE_AT.y) * scale,
      },
      deskWidth: lengthOf('var(--desk-width)', screen, properties),
      roomWidth: lengthOf('var(--room-width)', screen, properties),
      belowMachine: lengthOf('var(--below-machine)', screen, properties),
      headerTop: lengthOf(valueOf(landscape.body, '.view__header', 'top'), screen, properties),
      headerRight: screen.width - lengthOf(valueOf(landscape.body, '.view__header', 'right'), screen, properties),
    };
  };

  it('gives the desk room for six bits a finger can press, and the room the rest', () => {
    for (const screen of LANDSCAPE_PHONES) {
      const { deskWidth, roomWidth } = geometry(screen);
      expect(deskWidth, label(screen)).toBeGreaterThanOrEqual(320);
      expect(deskWidth, label(screen)).toBeLessThanOrEqual(screen.width / 2 + 40);
      expect(deskWidth + roomWidth, label(screen)).toBeCloseTo(screen.width, 6);
    }
  });

  it('shows the whole machine in its own part of the screen: the desk is never over it', () => {
    for (const screen of LANDSCAPE_PHONES) {
      const { machine, roomWidth } = geometry(screen);
      expect(machine.left, label(screen)).toBeGreaterThanOrEqual(screen.safe?.left ?? 0);
      expect(machine.right, label(screen)).toBeLessThan(roomWidth);
      expect(machine.foot, label(screen)).toBeLessThan(screen.height);
    }
  });

  it('shows the machine at a size worth looking at', () => {
    for (const screen of LANDSCAPE_PHONES) {
      const { machine } = geometry(screen);
      expect(machine.foot - machine.top, label(screen)).toBeGreaterThan(screen.height * 0.36);
    }
  });

  it('puts the header above the machine, and stops it short of the desk', () => {
    for (const screen of LANDSCAPE_PHONES) {
      const { machine, headerTop, headerRight, roomWidth } = geometry(screen);
      expect(headerTop + HEADER_LINE, label(screen)).toBeLessThanOrEqual(machine.top);
      expect(headerRight, label(screen)).toBeLessThan(roomWidth);
    }
  });

  it('leaves a line beneath the machine for what is said about it', () => {
    for (const screen of LANDSCAPE_PHONES) {
      const { machine, belowMachine } = geometry(screen);
      expect(belowMachine, label(screen)).toBeGreaterThanOrEqual(machine.foot);
      // Two lines of the laboratory's remark, at the size it is set in.
      expect(belowMachine + 40, label(screen)).toBeLessThanOrEqual(screen.height - (screen.safe?.bottom ?? 0));
    }
  });

  it('fills the room’s part of the screen with the room', () => {
    // A window nearer square than any phone on its side is the one case in which the room ends above the foot of the screen.
    const squarer = mediaBlocks(landscape.body).find((block) => /^\(max-aspect-ratio: \d+\/\d+\)$/.test(block.query));
    const [, wide_ = '0', high = '1'] = /(\d+)\/(\d+)/.exec(squarer?.query ?? '') ?? [];
    const squarest = Number(wide_) / Number(high);

    let endsShort = 0;
    for (const screen of LANDSCAPE_PHONES) {
      const { canvas, roomWidth } = geometry(screen);
      expect(canvas.left, label(screen)).toBeLessThanOrEqual(0);
      expect(canvas.right, label(screen)).toBeGreaterThanOrEqual(roomWidth);
      expect(canvas.top, label(screen)).toBeLessThanOrEqual(0);
      if (canvas.bottom < screen.height) {
        // Wherever it does end short, that is a window the fade applies to.
        endsShort += 1;
        expect(screen.width / screen.height, label(screen)).toBeLessThanOrEqual(squarest);
      }
      // On a phone — 16:9 or longer — it never does.
      if (screen.width / screen.height >= 1.77) {
        expect(canvas.bottom, label(screen)).toBeGreaterThanOrEqual(screen.height);
      }
    }
    expect(endsShort).toBeGreaterThan(0);
    // There, as on a phone held upright, it fades into the page instead of stopping at an edge.
    expect(ruleOf(squarer?.body ?? '', '.stage__canvas')).toMatch(/mask-image:\s*linear-gradient\(to bottom, #000 \d+%, transparent 100%\);/);
  });

  it('takes the laboratory’s remark out of the desk and sets it beneath the machine', () => {
    const note = ruleOf(landscape.body, '.laboratory__note');
    expect(note).toMatch(/position:\s*absolute;/);
    expect(note).toMatch(/top:\s*var\(--below-machine\);/);
    expect(note).toMatch(/right:\s*calc\(100% \+ \d+px\);/);
  });
});

describe('every view is built from the same parts, which a composition can place', () => {
  const views = ['mainMenuView', 'laboratoryView', 'quantumView', 'revealView', 'creditsView'];

  it('has a header, and a desk made of what there is to read and what there is to do', () => {
    for (const view of views) {
      const source = sourceOf(`/ui/views/${view}.ts`);
      for (const part of ['view__header', 'view__desk', 'view__body', 'view__actions']) {
        expect(source, `${view}: ${part}`).toMatch(new RegExp(`className: '${part}\\b`));
      }
    }
  });

  it('leaves layout and appearance to the stylesheets: no view sets a style by hand', () => {
    for (const view of views) {
      // The one exception is a custom property that tells the stylesheet where the machine is.
      const source = sourceOf(`/ui/views/${view}.ts`).replace(/\.style\.setProperty\('--machine-offset-y'/g, '');
      expect(source, view).not.toMatch(/\.style\b/);
    }
  });

  it('puts every control a scene offers in its actions, except those that belong to a reading', () => {
    // The laboratory's ASK is part of the console, and the two choices are part of the log.
    expect(sourceOf('/ui/views/laboratoryView.ts')).toMatch(
      /className: 'view__actions laboratory__actions' \}, \[\s*createControlButton\(\{\s*label: 'RETURN',[\s\S]*?\}\),\s*quantumModeButton,\s*\]/,
    );
    expect(sourceOf('/ui/views/quantumView.ts')).toMatch(/className: 'view__actions q-actions' \}, \[runButton, nextButton\]/);
    expect(sourceOf('/ui/views/revealView.ts')).toMatch(/className: 'view__actions reveal__actions' \}, \[nextButton\]/);
    expect(sourceOf('/ui/views/creditsView.ts')).toMatch(/className: 'view__actions credits__actions' \}, \[nextButton\]/);
  });
});

describe('the laboratory, where its record may scroll out of sight', () => {
  const view = sourceOf('/ui/views/laboratoryView.ts');

  it('says how many queries have been used in the header as well as in the log', () => {
    expect(view).toMatch(/queryTally\.textContent = formatCount\(progress\.queryCount\);/);
    // The log is where it is announced from: the copy is not read out a second time.
    expect(view).toMatch(/className: 'readout laboratory__tally', attributes: \{ 'aria-hidden': 'true' \}/);
    // In a wide window the log is always in view, and the copy is not shown.
    expect(ruleOf(wide.body, '.laboratory__tally')).toMatch(/display:\s*none;/);
    expect(phone.body + portrait.body + landscape.body).not.toMatch(/\.laboratory__tally/);
  });

  it('brings the constraint into view when it is disclosed', () => {
    const reveal = /revealPromise\([^)]*\) \{([\s\S]*?)\n {4}\},/.exec(view)?.[1] ?? '';
    expect(reveal).toMatch(/if \(arrive\) \{\s*readings\.scrollTop = 0;\s*constraint\.arrive\(\);/);
    // It is the first thing in the record, so the top is where it is.
    expect(view).toMatch(/className: 'view__body laboratory__record' \}, \[\s*createElement\('div', \{ className: 'laboratory__constraint' \}/);
  });

  it('takes up no room for the constraint before it is disclosed', () => {
    expect(ruleOf(phone.body, '.laboratory__constraint')).toMatch(/display:\s*contents;/);
  });

  it('shows the same sixty-four inputs in the same order, in rows that fit a phone', () => {
    const columns = /repeat\((\d+), 1fr\)/.exec(valueOf(phone.body, '.input-space__grid', 'grid-template-columns'));
    expect(64 % Number(columns?.[1])).toBe(0);
  });
});

describe('Quantum Mode says how far the run has got, and nothing of what it will find', () => {
  const view = sourceOf('/ui/views/quantumView.ts');

  it('lists the stages of a run in the order the scene reaches them', () => {
    expect(view).toMatch(/const RUN_STAGES: readonly string\[\] = \[Q_COPY\.prep, Q_COPY\.sup, Q_COPY\.or, Q_COPY\.inter, Q_COPY\.meas\];/);
    // The scene names each stage with the same words, in the same order.
    const scene = sourceOf('/scenes/QuantumScene.ts');
    const named = [...scene.matchAll(/step\.id === '([\w-]+)' \? Q_COPY\.(\w+)/g)].map((match) => match[2]);
    expect(named).toEqual(['prep', 'sup', 'or', 'inter', 'meas']);
  });

  it('moves the sequence on from the name of the stage alone', () => {
    const setStage = /setStage\(stage\) \{([\s\S]*?)\n {4}\},/.exec(view)?.[1] ?? '';
    expect(setStage).toMatch(/const index = RUN_STAGES\.indexOf\(stage\);\s*if \(index >= 0\) \{\s*renderSequence\(index \+ 1\);/);
    expect(setStage).not.toMatch(/result/);
  });

  it('draws the sequence without being told anything a run has read', () => {
    const renderSequence = /function renderSequence\(([^)]*)\): void \{([\s\S]*?)\n {2}\}/.exec(view);
    expect(renderSequence?.[1]).toBe('reached: number, complete = false');
    expect(renderSequence?.[2]).not.toMatch(/result|measured|Q_COPY/);
    // The only words in this view for a kind of machine would be these two.
    expect(view).not.toMatch(/Q_COPY\.(c|b)\b/);
  });

  it('takes two things from the result of a run and no more: what was read, and how many queries it cost', () => {
    const read = [...view.matchAll(/\bresult\.(\w+)/g)].map((match) => match[1]);
    expect([...new Set(read)].sort()).toEqual(['measuredLabel', 'oracleQueries']);
    // Nothing is taken from it by another name, or handed on whole to anything that could.
    expect(view).not.toMatch(/\{[^}]*\}\s*=\s*result\b|\(result\)|result\[/);
    expect(view).not.toMatch(/\b(verdict|isConstant|isBalanced)\b/);
  });

  it('marks the sequence complete only when the result of a run is shown', () => {
    expect(view.match(/renderSequence\(stages\.length, true\)/g)).toHaveLength(1);
    const showResult = /showResult\(result, isFirstRun\) \{([\s\S]*?)\n {4}\},/.exec(view)?.[1] ?? '';
    expect(showResult).toMatch(/renderSequence\(stages\.length, true\);/);
  });

  it('tells how a stage stands by the shape of its mark and in words, not by colour alone', () => {
    const css = withoutComments(viewsCss);
    // Still to come: a ring. Done: the ring filled. In progress: turned to a diamond.
    expect(ruleOf(css, '.q-sequence__mark')).toMatch(/border:[^;]*currentColor;[\s\S]*border-radius:\s*50%;/);
    expect(ruleOf(css, ".q-sequence__stage[data-state='done'] .q-sequence__mark")).toMatch(/background:\s*currentColor;/);
    const current = ruleOf(css, ".q-sequence__stage[data-state='current'] .q-sequence__mark");
    expect(current).toMatch(/transform:\s*rotate\(45deg\);/);
    expect(current).toMatch(/border-radius:\s*1px;/);
    expect(ruleOf(css, ".q-sequence__stage[data-state='current']")).toMatch(/font-weight:\s*600;/);

    expect(view).toMatch(/element\.setAttribute\('aria-current', 'step'\);/);
    expect(view).toMatch(/standing\.textContent = `, \$\{STAGE_STANDING\[state\]\}`;/);
  });

  it('keeps the control that starts a run in reach of the keyboard while a run is under way', () => {
    const setRunDisabled = /setRunDisabled\(disabled\) \{([\s\S]*?)\n {4}\},/.exec(view)?.[1] ?? '';
    expect(setRunDisabled).toMatch(/setUnavailable\(runButton, disabled\);/);
    expect(setRunDisabled).not.toMatch(/'disabled'/);
  });

  it('keeps the colour the room has not shown before to this scene, and out of where things are placed', () => {
    const css = withoutComments(viewsCss);
    for (const [selector] of css.matchAll(/[^{}]+(?=\{[^}]*--color-quantum-)/g)) {
      expect(selector.trim()).toMatch(/^\.q-/);
    }
    expect(withoutComments(compositionsCss)).not.toMatch(/--color-quantum|#[0-9a-f]{6}\b|rgb\(/i);
  });
});

describe('the reveal and the credits', () => {
  it('shows the finding a line at a time, and the way on last of all', () => {
    const view = sourceOf('/ui/views/revealView.ts');
    expect(view).toMatch(/const steps = \[\.\.\.lines, nextButton\];/);
    expect(view).toMatch(/steps\[Math\.min\(index, steps\.length - 1\)\]\?\.setAttribute\('data-shown', ''\);/);
    // Five lines, in the order the scene shows them.
    const lines = [...view.matchAll(/className: 'readout reveal__(\w+)'/g)].map((match) => match[1]);
    expect(lines).toEqual(['label', 'value', 'reading', 'therefore', 'verdict']);
  });

  it('keeps a part of the finding out of sight, and the control out of use, until it is shown', () => {
    const css = withoutComments(viewsCss);
    expect(ruleOf(css, '.reveal__step')).toMatch(/opacity:\s*0;/);
    expect(ruleOf(css, '.reveal__step[data-shown]')).toMatch(/opacity:\s*1;/);
    expect(ruleOf(css, '.control.reveal__step:not([data-shown])')).toMatch(/pointer-events:\s*none;/);
  });

  it('does not fade anything in for a player who has asked for reduced motion', () => {
    const reduced = mediaBlocks(viewsCss).filter((block) => block.query === '(prefers-reduced-motion: reduce)');
    expect(reduced.some((block) => /\.reveal__step,\s*\.control\.reveal__step\s*\{\s*transition:\s*none;\s*\}/.test(block.body))).toBe(true);
  });

  it('lets the credits scroll where they are longer than the space they have, by touch or by keyboard', () => {
    expect(ruleOf(wide.body, '.credits__record')).toMatch(/overflow-y:\s*auto;[\s\S]*pointer-events:\s*auto;/);
    expect(sourceOf('/ui/views/creditsView.ts')).toMatch(/className: 'view__body credits__record', attributes: \{ tabindex: '0'/);
  });
});

describe('a control answers a pointer only if the pointer can hover', () => {
  it('has no hover style outside a query for a pointer that hovers', () => {
    for (const [name, css] of [
      ['components.css', componentsCss],
      ['oracle.css', oracleCss],
    ] as const) {
      const hoverBlocks = mediaBlocks(css).filter((block) => block.query === '(hover: hover)');
      expect(hoverBlocks.length, name).toBeGreaterThan(0);

      // Take those blocks away, and the reduced-motion ones (which only switch a hover's movement off). No hover is left.
      let rest = withoutComments(css);
      for (const block of mediaBlocks(css).filter((candidate) => /hover: hover|prefers-reduced-motion/.test(candidate.query))) {
        rest = rest.replace(block.body, '');
      }
      const strayHover = [...rest.matchAll(/([^{}]*:hover[^{}]*)\{/g)]
        .map((match) => (match[1] ?? '').trim())
        // A pressed control says so whether or not it is hovered: that rule only stops a hover from changing it.
        .filter((selector) => !selectorsOf(selector).every((part) => part.includes("[aria-pressed='true']")));
      expect(strayHover, name).toEqual([]);
    }
  });

  it('tells a control that is out of use apart by more than a shade', () => {
    expect(ruleOf(withoutComments(componentsCss), ".control[aria-disabled='true']")).toMatch(/border-style:\s*dashed;/);
    expect(ruleOf(withoutComments(oracleCss), ".bit[aria-disabled='true']")).toMatch(/border-style:\s*dashed;/);
  });
});
