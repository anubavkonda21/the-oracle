import { SCENE_KEYS } from '../config/sceneKeys';
import { StageScene } from './StageScene';
import { createRevealView, type RevealView } from '../ui/views/revealView';

import type { DeutschJozsaResult } from '../../quantum/deutschJozsa';

export interface RevealEntry {
  result: DeutschJozsaResult;
}

export class RevealScene extends StageScene {
  private view!: RevealView;

  constructor() {
    super(SCENE_KEYS.reveal);
  }

  create(entry: RevealEntry): void {
    // There is nothing to reveal without the result of a run. Rather than fail on a blank stage,
    // go back to the laboratory as it was left.
    if (!entry?.result) {
      this.scene.start(SCENE_KEYS.laboratory, { resume: true });
      return;
    }

    this.view = createRevealView({
      result: entry.result,
      onNext: () => this.leaveTo(SCENE_KEYS.credits),
    });

    this.enterStage(this.view.element, 'dark');

    let delay = 1000;
    const pauses = [2000, 2000, 2000, 1000, 1000, 1000, 1000];
    for (let i = 0; i <= 5; i++) {
        this.afterDelay(delay, () => this.view.showLine(i));
        delay += pauses[i] ?? 1000;
    }
  }
}
