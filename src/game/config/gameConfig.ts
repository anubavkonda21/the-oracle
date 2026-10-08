import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { QuantumScene } from '../scenes/QuantumScene';
import { RevealScene } from '../scenes/RevealScene';
import { CreditsScene } from '../scenes/CreditsScene';
import { LaboratoryScene } from '../scenes/LaboratoryScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { RoomScene } from '../scenes/RoomScene';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './display';

export interface GameConfigOptions {
  /** Element the canvas is mounted into. Phaser fits the canvas to this element's size. */
  parent: HTMLElement;
  /** Canvas pixels per design unit — see `resolveRenderResolution`. */
  renderResolution: number;
}

export function createGameConfig({ parent, renderResolution }: GameConfigOptions): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    // The page's own colour shows round the 16:10 stage, and the room fades into
    // it at its edges, so the stage has no visible border in a window of any shape.
    transparent: true,
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DESIGN_WIDTH * renderResolution,
      height: DESIGN_HEIGHT * renderResolution,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    input: {
      keyboard: true,
      mouse: true,
      gamepad: false,
    },
    // Sound arrives in a later checkpoint. Until then, don't create an audio context at all.
    audio: { noAudio: true },
    // Scenes draw in this order. The room comes before the scenes the player moves through, so it is beneath them all.
    scene: [BootScene, PreloadScene, RoomScene, MainMenuScene, LaboratoryScene, QuantumScene, RevealScene, CreditsScene],
  };
}
