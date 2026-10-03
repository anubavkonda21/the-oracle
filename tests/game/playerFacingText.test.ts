import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';

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
const NOT_YET_REVEALED = /deutsch|jozsa|phase|hadamard|qubit/i;

/**
 * Ideas THE BOX introduces — but only in its short context, after the player
 * has observed. The laboratory still presents its machine as nothing more
 * than a machine, so these stay out of every other file.
 */

/**
 * The names of the two kinds of machine. The laboratory introduces them when
 * it discloses the constraint, and not before — so, as text for the player,
 * they live in one file, which the interface shows nothing of until then.
 */
const INTRODUCED_BY_THE_PROMISE = /constant|balanced/i;
const PROMISE_COPY_FILE = '/config/promiseConfig.ts';

/**
 * The same two words are also how the code itself names the kinds — as the
 * values of a type and in one error message — in the modules that reason
 * about them. None of these is interface code, and none builds anything the
 * player sees.
 */
const KINDS_AS_CODE = ['/systems/oracle/oracleKind.ts', '/systems/oracle/evidence.ts', '/systems/oracle/promise.ts'];

const mayNameTheKinds = (path: string): boolean =>
  path.endsWith(PROMISE_COPY_FILE) || KINDS_AS_CODE.some((file) => path.endsWith(file));

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
    for (const fileName of [
      '/laboratoryView.ts',
      '/LaboratoryScene.ts',
      '/experimentLog.ts',
      '/inputSpaceMap.ts',
      '/constraintPlate.ts',
      '/classificationRecord.ts',
      '/config/investigationConfig.ts',
      
      
      
      PROMISE_COPY_FILE,
      ...KINDS_AS_CODE,
    ]) {
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
  });

  it('keeps the names of the two kinds of machine out of everything except the text of the constraint', () => {
    expect(offendingStrings(INTRODUCED_BY_THE_PROMISE, (path) => !mayNameTheKinds(path))).toEqual([]);
  });

  it('never spells those names in the interface itself: scenes, views and components take them from that one file', () => {
    const interfaceCode = (path: string): boolean => path.includes('/ui/') || path.includes('/scenes/') || path.includes('/entities/');

    expect(Object.keys(gameSources).filter(interfaceCode).length).toBeGreaterThan(15);
    expect(offendingStrings(INTRODUCED_BY_THE_PROMISE, interfaceCode)).toEqual([]);
    expect(KINDS_AS_CODE.filter(interfaceCode)).toEqual([]);
  });

  it('names the two kinds, in the text of the constraint', () => {
    const promiseText = Object.entries(gameSources)
      .filter(([path]) => path.endsWith(PROMISE_COPY_FILE))
      .flatMap(([, source]) => stringLiterals(source));

    expect(promiseText).toContain('CONSTANT');
    expect(promiseText).toContain('BALANCED');
    for (const text of promiseText) {
      expect(text).not.toMatch(NOT_YET_REVEALED);
    }
  });

  it('contains no such term in the page itself', () => {
    const visibleText = indexHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    expect(visibleText).not.toMatch(NOT_YET_REVEALED);
    expect(visibleText).not.toMatch(INTRODUCED_BY_THE_PROMISE);
  });

  it('uses the words the laboratory is meant to show', () => {
    const allText = Object.values(gameSources).flatMap(stringLiterals);
    for (const expected of [
      'ASK',
      'INPUT',
      'EXPERIMENT LOG',
      'QUERIES USED',
      'OUTPUT',
      'PROCESSING',
      'Find out what the machine does.',
      'INPUT SPACE',
      'TESTED',
      'UNTESTED',
      'NO QUERY USED',
      'ORACLE CONSTRAINT',
      'This machine is guaranteed to obey one of two rules.',
      'Determine which kind of Oracle you are dealing with.',
      'OUTPUTS OBSERVED',
      'CONCLUSION',
    ]) {
      expect(allText).toContain(expected);
    }
  });

  it('reads the remarks on the investigation too, which are assembled from pieces', () => {
    // The remarks are template strings with numbers filled in. Their fixed words are what must be checked.
    const investigationText = Object.entries(gameSources)
      .filter(([path]) => path.endsWith('/config/investigationConfig.ts'))
      .flatMap(([, source]) => stringLiterals(source));

    expect(investigationText).toContain('There may be a better way to ask.');
    expect(investigationText.some((text) => text.includes('possible inputs'))).toBe(true);
    for (const text of investigationText) {
      expect(text).not.toMatch(NOT_YET_REVEALED);
      // The remarks start before the constraint is disclosed, so they do not name the kinds either.
      expect(text).not.toMatch(INTRODUCED_BY_THE_PROMISE);
    }
  });
});
