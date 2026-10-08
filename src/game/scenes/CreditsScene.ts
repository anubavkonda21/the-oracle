import { SCENE_KEYS } from '../config/sceneKeys';
import { theRoom } from './RoomScene';
import { StageScene } from './StageScene';
import { createCreditsView, type CreditsView } from '../ui/views/creditsView';

export class CreditsScene extends StageScene {
  private view!: CreditsView;

  constructor() {
    super(SCENE_KEYS.credits);
  }

  create(): void {
    this.view = createCreditsView({
      onNext: () => this.leaveTo(SCENE_KEYS.mainMenu),
    });

    this.enterStage(this.view.element, 'dark');

    // The laboratory shuts down for the night: the work light first, then the rest.
    const room = theRoom(this);
    room.light('power-down');
    room.machine.rest();
  }
}
