/** Scene keys live apart from the scene classes so scenes can reference each other without import cycles. */
export const SCENE_KEYS = {
  boot: 'Boot',
  preload: 'Preload',
  mainMenu: 'MainMenu',
  laboratory: 'Laboratory',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
