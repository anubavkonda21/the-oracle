import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/sceneKeys';
import { StageEnvironment } from '../effects/StageEnvironment';
import { StageFade } from '../effects/StageFade';
import { GameSession } from '../systems/GameSession';
import { installDesktopGate } from '../systems/desktopGate';
import { registerServices } from '../systems/services';
import { UiLayer } from '../ui/UiLayer';
import { queryShell } from '../ui/shell';

/** First scene to run. Sets up everything the other scenes rely on, then hands over to PreloadScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    const shell = queryShell();

    registerServices(this.registry, {
      ui: new UiLayer(shell.uiRoot),
      stageFade: new StageFade(shell.stage),
      stageEnvironment: new StageEnvironment(shell.stage),
      session: new GameSession(),
    });
    installDesktopGate(this.game);

    this.scene.start(SCENE_KEYS.preload);
  }
}
