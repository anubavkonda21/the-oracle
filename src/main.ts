import Phaser from 'phaser';
import './styles/global.css';
import { resolveRenderResolution } from './game/config/display';
import { createGameConfig } from './game/config/gameConfig';
import { applyPaperGrain } from './game/effects/paperGrain';
import { queryShell } from './game/ui/shell';

declare global {
  interface Window {
    /** Development-only handle for inspecting the running game from the browser console. */
    __ORACLE__?: Phaser.Game;
  }
}

const shell = queryShell();
applyPaperGrain(shell.app);

const renderResolution = resolveRenderResolution({
  devicePixelRatio: window.devicePixelRatio,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
});

const game = new Phaser.Game(createGameConfig({ parent: shell.canvasHost, renderResolution }));

if (import.meta.env.DEV) {
  window.__ORACLE__ = game;
}
