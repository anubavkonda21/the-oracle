import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';

/** Source of every file in the game layer, keyed by path. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Ideas the player has not met yet. At this stage the machine is only "a
 * strange machine that answers a binary input"; none of these may appear in
 * anything the player can read.
 */
const NOT_YET_REVEALED = /constant|balanced|deutsch|jozsa|quantum|superposition|phase|hadamard|qubit/i;

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

describe('what the player can read', () => {
  it('finds the game sources to check', () => {
    const paths = Object.keys(gameSources);
    expect(paths.length).toBeGreaterThan(25);
    expect(paths.some((path) => path.endsWith('/laboratoryView.ts'))).toBe(true);
    expect(paths.some((path) => path.endsWith('/LaboratoryScene.ts'))).toBe(true);
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
    const offenders = Object.entries(gameSources).flatMap(([path, source]) =>
      stringLiterals(source)
        .filter((text) => NOT_YET_REVEALED.test(text))
        .map((text) => `${path}: "${text}"`),
    );
    expect(offenders).toEqual([]);
  });

  it('contains no such term in the page itself', () => {
    const visibleText = indexHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    expect(visibleText).not.toMatch(NOT_YET_REVEALED);
  });

  it('uses the words the laboratory is meant to show', () => {
    const allText = Object.values(gameSources).flatMap(stringLiterals);
    for (const expected of ['ASK', 'INPUT', 'EXPERIMENT LOG', 'QUERIES', 'OUTPUT', 'PROCESSING', 'Find out what the machine does.']) {
      expect(allText).toContain(expected);
    }
  });
});
