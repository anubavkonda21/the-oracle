import type { BooleanFunction } from '../../quantum';
import { createOracle } from '../../quantum/oracle';
import { runDeutschJozsa } from '../../quantum/deutschJozsa';
import { SCENE_KEYS } from '../config/sceneKeys';
import { StageScene } from './StageScene';
import { createQuantumView, type QuantumView } from '../ui/views/quantumView';

export interface QuantumEntry {
  hiddenFunction: BooleanFunction;
}

export class QuantumScene extends StageScene {
  private view!: QuantumView;
  private hiddenFunction!: BooleanFunction;
  private hasRun = false;

  constructor() {
    super(SCENE_KEYS.quantum);
  }

  create(entry: QuantumEntry): void {
    this.hiddenFunction = entry.hiddenFunction;

    this.view = createQuantumView({
      onRun: () => this.runAlgorithm(),
      onNext: () => this.leaveTo(SCENE_KEYS.reveal, { hiddenFunction: this.hiddenFunction }),
    });

    this.enterStage(this.view.element, 'dark');
  }

  private runAlgorithm(): void {
    const stages = ['PREPARE', 'SUPERPOSITION', 'ORACLE', 'INTERFERENCE', 'MEASURE'];
    let delay = 0;
    for (const stage of stages) {
        this.afterDelay(delay, () => this.view.setStage(stage));
        delay += 500;
    }

    this.afterDelay(delay, () => {
      const oracle = createOracle(this.hiddenFunction);
      const result = runDeutschJozsa(oracle);
      this.view.showResult(result, !this.hasRun);
      this.view.setStage('RESULT');
      this.hasRun = true;
    });
  }
}
