/** The fixed words of the game's identity, kept in one place so every scene presents them identically. */
export const GAME_IDENTITY = {
  title: { article: 'THE', name: 'ORACLE' },
  tagline: ['You don’t need to know what’s inside.', 'You only need to know how to ask.'],
  systemIdentifier: 'QURIOSITY / 07',
} as const;

/** Total number of levels; drives the "01 / 06" progression indicator. */
export const LEVEL_COUNT = 6;
