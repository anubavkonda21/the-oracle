import type Phaser from 'phaser';

/** The event a Phaser scene emits when it stops (`Phaser.Scenes.Events.SHUTDOWN`). Written out so this module can be loaded without Phaser, by the unit tests. */
const SCENE_SHUTDOWN = 'shutdown';

/** The parts of a keyboard event that decide whether it is a key press meant for the game. */
export interface KeyPressLike {
  readonly defaultPrevented: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/**
 * True for a plain key press the game should act on. A press that something
 * else has already handled is left alone, and so is any combination with
 * Ctrl, Cmd or Alt: those belong to the browser (Cmd+1 switches tab, Ctrl+0
 * resets zoom) and must not also type a 1 or a 0 into the machine.
 */
export function isGameKeyPress(event: KeyPressLike): boolean {
  return !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/**
 * Delivers every key press to a scene exactly once, until the scene shuts down.
 *
 * Phaser's own keyboard events are not used for this. Its plugin keeps the
 * key events of the current frame in a queue and walks the whole queue again
 * each time another event arrives, so when several land in one frame — fast
 * typing, or a slow frame — earlier presses are emitted a second time. Here
 * that would enter a digit twice. The browser's `keydown` fires once per
 * press whatever the frame rate.
 *
 * The desktop gate still applies: while it has the game's keyboard switched
 * off, nothing is delivered.
 */
export function listenForKeyPresses(scene: Phaser.Scene, onKeyPress: (event: KeyboardEvent) => void): void {
  const listener = (event: KeyboardEvent): void => {
    const keyboardEnabled = scene.game.input.keyboard?.enabled ?? true;
    if (keyboardEnabled && isGameKeyPress(event)) {
      onKeyPress(event);
    }
  };

  window.addEventListener('keydown', listener);
  scene.events.once(SCENE_SHUTDOWN, () => window.removeEventListener('keydown', listener));
}
