import { DESIGN_WIDTH } from '../config/display';
import { SCENE_KEYS } from '../config/sceneKeys';
import { OracleMachine } from '../entities/OracleMachine';
import { createLaboratoryView } from '../ui/views/laboratoryView';
import { StageScene } from './StageScene';

/** Vertical centre of the machine: slightly above the middle of the 900-unit-tall frame. */
const MACHINE_CENTER_Y = 408;

/**
 * PLACEHOLDER laboratory: the machine on the canvas and an empty HUD shell
 * around it. It exists to establish the visual language. There is no gameplay
 * here yet — no queries, no Oracle behaviour, no level logic.
 */
export class LaboratoryScene extends StageScene {
  constructor() {
    super(SCENE_KEYS.laboratory);
  }

  create(): void {
    const returnToMenu = (): void => this.leaveTo(SCENE_KEYS.mainMenu);

    this.enterStage(
      createLaboratoryView({
        levelNumber: 1,
        objective: 'Explore the laboratory.',
        onReturn: returnToMenu,
      }),
    );

    new OracleMachine(this, DESIGN_WIDTH / 2, MACHINE_CENTER_Y);

    this.input.keyboard?.on('keydown-ESC', returnToMenu);
  }
}
