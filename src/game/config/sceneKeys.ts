export const SCENE_KEYS = {
  boot: 'Boot',
  preload: 'Preload',
  /** The laboratory itself. It runs beneath every scene after it, for as long as the game does. */
  room: 'Room',
  mainMenu: 'MainMenu',
  laboratory: 'Laboratory',
  quantum: 'QMode',
  reveal: 'Reveal',
  credits: 'Credits',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
