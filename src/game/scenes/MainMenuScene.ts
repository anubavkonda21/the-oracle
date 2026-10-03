import { SCENE_KEYS } from '../config/sceneKeys';
import { createMainMenuView } from '../ui/views/mainMenuView';
import { StageScene } from './StageScene';

/** The title screen. Nothing is drawn on the canvas here: the identity is pure typography, rendered by the UI layer. */
export class MainMenuScene extends StageScene {
  constructor() {
    super(SCENE_KEYS.mainMenu);
  }

  create(): void {
    const enterLaboratory = (): void => this.leaveTo(SCENE_KEYS.laboratory);

    this.enterStage(createMainMenuView({ onEnter: enterLaboratory }));

    // The Enter key works from anywhere, not only while the ENTER control has focus.
    this.input.keyboard?.on('keydown-ENTER', enterLaboratory);
  }
}
