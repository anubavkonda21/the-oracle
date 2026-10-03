import { describe, expect, it } from 'vitest';

/** Source text of the game's files, for checking that nothing is written to storage. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('GameSession', () => {
  it('is kept in memory, not in the browser’s storage', () => {
    const usesStorage = Object.entries(gameSources)
      .filter(([, source]) => /localStorage|sessionStorage|indexedDB|document\.cookie/.test(source))
      .map(([path]) => path);
    expect(usesStorage).toEqual([]);
  });
});
