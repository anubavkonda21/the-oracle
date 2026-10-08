import { audioManager } from '../audio/AudioManager';
import { SCENE_KEYS } from '../config/sceneKeys';
import { listenForKeyPresses } from '../systems/keyboard';
import { createMainMenuView } from '../ui/views/mainMenuView';
import { theRoom } from './RoomScene';
import { StageScene } from './StageScene';

/**
 * The title screen: the game's name, over the laboratory in the dark. The room is dormant and the
 * machine at rest; entering brings both up.
 */
export class MainMenuScene extends StageScene {
  constructor() {
    super(SCENE_KEYS.mainMenu);
  }

  create(): void {
    const enterLaboratory = (): void => { audioManager.init(); this.leaveTo(SCENE_KEYS.laboratory); };

    this.enterStage(createMainMenuView({ onEnter: enterLaboratory }));

    const room = theRoom(this);
    room.light('dormant');
    room.machine.rest();

    // The Enter key works from anywhere, not only while the ENTER control has focus.
    listenForKeyPresses(this, (event) => {
      if (event.key === 'Enter' && !event.repeat) {
        enterLaboratory();
      }
    });
  }
}
