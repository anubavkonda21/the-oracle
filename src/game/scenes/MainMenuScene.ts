import { audioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../config/sceneKeys';
import { listenForKeyPresses } from '../systems/keyboard';
import { createMainMenuView } from '../ui/views/mainMenuView';
import { StageScene } from './StageScene';

/** The title screen. Nothing is drawn on the canvas here: the identity is pure typography, rendered by the UI layer. */
export class MainMenuScene extends StageScene {
  constructor() {
    super(SCENE_KEYS.mainMenu);
  }

  create(): void {
    const enterLaboratory = (): void => { audioManager.init(); this.leaveTo(SCENE_KEYS.laboratory); };

    this.enterStage(createMainMenuView({ onEnter: enterLaboratory }));

    // The Enter key works from anywhere, not only while the ENTER control has focus.
    listenForKeyPresses(this, (event) => {
      if (event.key === 'Enter' && !event.repeat) {
        enterLaboratory();
      }
    });
  }
}
