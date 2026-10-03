export const SCENE_KEYS = {
  boot: 'Boot',
  preload: 'Preload',
  mainMenu: 'MainMenu',
  laboratory: 'Laboratory',
  quantum: 'QMode',
  reveal: 'Reveal',
  credits: 'Credits',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
