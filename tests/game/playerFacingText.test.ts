import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { BOX_COPY } from '../../src/game/config/boxConfig';

/** Source of every file in the game layer, keyed by path. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Ideas the player has not met at any point so far. None of these may appear
 * in anything the player can read, anywhere in the game.
 */
const NOT_YET_REVEALED = /constant|balanced|deutsch|jozsa|phase|hadamard|qubit/i;

/**
 * Ideas THE BOX introduces — but only in its short context, after the player
 * has observed. The laboratory still presents its machine as nothing more
 * than a machine, so these stay out of every other file.
 */
const INTRODUCED_BY_THE_BOX = /quantum|superposition/i;
const BOX_COPY_FILE = '/config/boxConfig.ts';

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Module paths are not shown to the player (`'../../quantum'` is an import, not interface text). */
const withoutModulePaths = (source: string): string =>
  source.replace(/\bfrom\s+(['"])[^'"]+\1/g, '').replace(/\bimport\s+(['"])[^'"]+\1/g, '');

/** The contents of every quoted string and template literal in a source file. */
function stringLiterals(source: string): string[] {
  const code = withoutModulePaths(withoutComments(source));
  return [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? '',
  );
}

function offendingStrings(pattern: RegExp, include: (path: string) => boolean): string[] {
  return Object.entries(gameSources)
    .filter(([path]) => include(path))
    .flatMap(([path, source]) =>
      stringLiterals(source)
        .filter((text) => pattern.test(text))
        .map((text) => `${path}: "${text}"`),
    );
}

describe('what the player can read', () => {
  it('finds the game sources to check', () => {
    const paths = Object.keys(gameSources);
    expect(paths.length).toBeGreaterThan(30);
    for (const fileName of ['/laboratoryView.ts', '/LaboratoryScene.ts', '/boxView.ts', '/BoxScene.ts', BOX_COPY_FILE]) {
      expect(paths.some((path) => path.endsWith(fileName))).toBe(true);
    }
  });

  it('can tell text from comments and import paths', () => {
    const sample = `
      // quantum in a comment is fine
      import { thing } from '../../quantum';
      const label = 'ASK';
      const hint = "a balanced meal";
    `;
    expect(stringLiterals(sample)).toEqual(['ASK', 'a balanced meal']);
  });

  it('contains no term the player has not been introduced to, anywhere in the game layer', () => {
    expect(offendingStrings(NOT_YET_REVEALED, () => true)).toEqual([]);
  });

  it('keeps the ideas THE BOX introduces out of everything except the text of THE BOX', () => {
    expect(offendingStrings(INTRODUCED_BY_THE_BOX, (path) => !path.endsWith(BOX_COPY_FILE))).toEqual([]);
  });

  it('contains no such term in the page itself', () => {
    const visibleText = indexHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    expect(visibleText).not.toMatch(NOT_YET_REVEALED);
    expect(visibleText).not.toMatch(INTRODUCED_BY_THE_BOX);
  });

  it('uses the words the laboratory is meant to show', () => {
    const allText = Object.values(gameSources).flatMap(stringLiterals);
    for (const expected of ['ASK', 'INPUT', 'EXPERIMENT LOG', 'QUERIES', 'OUTPUT', 'PROCESSING', 'Find out what the machine does.']) {
      expect(allText).toContain(expected);
    }
  });
});

describe('what the player reads in THE BOX', () => {
  /** Everything visible before the player has observed. */
  const beforeObserving = [
    BOX_COPY.label,
    BOX_COPY.status.sealed,
    BOX_COPY.status.observing,
    BOX_COPY.sealedNote,
    BOX_COPY.observe,
    BOX_COPY.leave,
  ];
  const context = BOX_COPY.context.join(' ');
  const everything = [...beforeObserving, ...Object.values(BOX_COPY.outcomes), BOX_COPY.complete, context].join(' ');

  it('explains nothing before the player acts', () => {
    for (const text of beforeObserving) {
      expect(text).not.toMatch(INTRODUCED_BY_THE_BOX);
      expect(text).not.toMatch(/measure|collapse|probab|cat|schr/i);
    }
  });

  it('offers OBSERVE as its one action, not a lesson', () => {
    expect(BOX_COPY.observe).toBe('OBSERVE');
    expect(everything).not.toMatch(/learn|lesson|quiz|question|correct|answer/i);
  });

  it('keeps the context to three sentences that take a few seconds to read', () => {
    expect(BOX_COPY.context).toHaveLength(3);
    expect(context.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  it('says the system was DESCRIBED BY a superposition, and names the thought experiment as one', () => {
    expect(context).toMatch(/described by a superposition of possible outcomes/);
    expect(context).toMatch(/Measurement produced one definite result/);
    expect(context).toMatch(/thought experiment/);
  });

  it('makes none of the claims it must not make', () => {
    // Not literally alive and dead at once; not changed by being looked at; nothing about consciousness.
    expect(everything).not.toMatch(/alive|dead/i);
    expect(everything).not.toMatch(/at the same time|both at once|simultaneous/i);
    expect(everything).not.toMatch(/conscious|mind|magic|looking|looked|watch/i);
    expect(everything).not.toMatch(/changed reality|creates? reality/i);
  });

  it('does not yet mention what later checkpoints will reveal', () => {
    expect(everything).not.toMatch(NOT_YET_REVEALED);
    expect(everything).not.toMatch(/kickback|quantum oracle/i);
  });

  it('names both outcomes, so the result never depends on the picture alone', () => {
    expect(Object.keys(BOX_COPY.outcomes).sort()).toEqual(['0', '1']);
    expect(BOX_COPY.outcomes[0]).not.toBe(BOX_COPY.outcomes[1]);
  });
});
