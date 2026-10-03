import type Phaser from 'phaser';
import { MIN_VIEWPORT_WIDTH } from '../config/display';

/** Matches viewports too narrow for the game. The same query hides the stage in shell.css. */
export const COMPACT_VIEWPORT_QUERY = `(max-width: ${MIN_VIEWPORT_WIDTH - 1}px)`;

/**
 * On a narrow viewport CSS swaps the game for the desktop-only notice. This
 * keeps the hidden game from reacting to the keyboard while that notice is up.
 */
export function installDesktopGate(game: Phaser.Game): void {
  const compactViewport = window.matchMedia(COMPACT_VIEWPORT_QUERY);

  const sync = (): void => {
    const keyboard = game.input.keyboard;
    if (keyboard) {
      keyboard.enabled = !compactViewport.matches;
    }
  };

  compactViewport.addEventListener('change', sync);
  sync();
}
