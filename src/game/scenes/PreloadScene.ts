import Phaser from 'phaser';
import { FONT_FAMILIES } from '../config/designTokens';
import { DESIGN_WIDTH } from '../config/display';
import { SCENE_KEYS } from '../config/sceneKeys';
import { createOracleMachineTextures } from '../entities/oracleMachineTextures';
import { loadFonts } from '../systems/fontLoader';
import { createRoomTextures } from '../world/roomTextures';
import { markBootComplete } from '../ui/shell';

/**
 * Gets every asset ready before the first visible scene. Three kinds of asset
 * pass through here:
 *
 *   files       — queued in `preload()` with Phaser's loader (none exist yet)
 *   procedural  — textures drawn in code at the game's render resolution
 *   web fonts   — declared in fonts.css, awaited here so text never reflows
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.preload);
  }

  preload(): void {
    // Future work: image, audio and data files are queued here, e.g.
    // this.load.image(TEXTURE_KEYS.someImage, someImageUrl). Phaser waits for
    // the queue to finish before it calls create().
  }

  create(): void {
    const renderResolution = this.scale.width / DESIGN_WIDTH;

    void loadFonts(Object.values(FONT_FAMILIES)).then(() => {
      // Painted once the fonts are in: the machine and the equipment round it have lettering on them.
      createOracleMachineTextures(this.textures, renderResolution);
      createRoomTextures(this.textures, renderResolution);
      markBootComplete();
      // The room is started here, once, and outlives every scene that follows.
      this.scene.launch(SCENE_KEYS.room);
      this.scene.start(SCENE_KEYS.mainMenu);
    });
  }
}
