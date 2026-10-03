import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/display';
import type { SceneKey } from '../config/sceneKeys';
import { getServices } from '../systems/services';

/**
 * Base class for every scene the player actually sees.
 *
 * It gives a scene two things: a camera framed on the 1440 × 900 design area
 * (so game objects are placed in design units, whatever the canvas resolution)
 * and the shared way of arriving at and leaving a scene.
 */
export abstract class StageScene extends Phaser.Scene {
  private isLeaving = false;

  /** Call at the start of `create()`: frames the camera, shows this scene's interface and fades the stage in. */
  protected enterStage(view: HTMLElement): void {
    this.isLeaving = false;

    // The canvas is `renderResolution` times larger than the design frame; zooming by the same factor cancels it out.
    const renderResolution = this.scale.width / DESIGN_WIDTH;
    this.cameras.main.setZoom(renderResolution).centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);

    const { ui, stageFade } = getServices(this.registry);
    ui.show(view);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ui.clear());
    stageFade.fadeIn();
  }

  /** Fades the stage out, then starts another scene. Repeat calls while already leaving are ignored. */
  protected leaveTo(sceneKey: SceneKey): void {
    if (this.isLeaving) {
      return;
    }
    this.isLeaving = true;

    const { stageFade } = getServices(this.registry);
    void stageFade.fadeOut().then(() => this.scene.start(sceneKey));
  }
}
