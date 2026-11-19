import { SCENE_KEYS } from '../config/sceneKeys';
import { StageScene } from './StageScene';
import { createRevealView, type RevealView } from '../ui/views/revealView';

export class RevealScene extends StageScene {
  private view!: RevealView;

  constructor() {
    super(SCENE_KEYS.reveal);
  }

  create(): void {
    this.view = createRevealView({
      onNext: () => this.leaveTo(SCENE_KEYS.credits),
    });

    this.enterStage(this.view.element, 'dark');

    let delay = 600;
    const pauses = [1000, 1200, 1200, 1400, 1200, 800];
    for (let i = 0; i <= 5; i++) {
      this.afterDelay(delay, () => this.view.showLine(i));
      delay += pauses[i] ?? 1000;
    }
  }
}
