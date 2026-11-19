import { audioManager } from '../audio/AudioManager';
import type { BooleanFunction } from '../../quantum';
import { createOracle } from '../../quantum/oracle';
import { runDeutschJozsa } from '../../quantum/deutschJozsa';
import { Q_COPY } from '../../qcopy';
import { SCENE_KEYS } from '../config/sceneKeys';
import { StageScene } from './StageScene';
import { createQuantumView, type QuantumView } from '../ui/views/quantumView';

export interface QuantumEntry {
  hiddenFunction: BooleanFunction;
}

export class QuantumScene extends StageScene {
  private view!: QuantumView;
  private hiddenFunction!: BooleanFunction;

  constructor() {
    super(SCENE_KEYS.quantum);
  }

  create(entry: QuantumEntry): void {
    this.hiddenFunction = entry.hiddenFunction;

    this.view = createQuantumView({
      onRun: () => this.runAlgorithm(),
      onNext: () => this.leaveTo(SCENE_KEYS.laboratory),
    });

    this.enterStage(this.view.element, 'dark');
  }

  private isRunning = false;

  private runAlgorithm(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.view.setRunDisabled(true);

    const oracle = createOracle(this.hiddenFunction);
    const result = runDeutschJozsa(oracle);

    const steps = result.steps;
    const delays: Record<string, number> = {
      prepared: 400,
      superposed: 1000,
      'ancilla-ready': 1000,
      queried: 1600,
      interfered: 2200,
      measured: 2800,
    };

    for (const step of steps) {
      const d = delays[step.id] || 0;
      this.afterDelay(d, () => {
        const stageName =
          step.id === 'prepared'
            ? Q_COPY.prep
            : step.id === 'superposed'
              ? Q_COPY.sup
              : step.id === 'queried'
                ? Q_COPY.or
                : step.id === 'interfered'
                  ? Q_COPY.inter
                  : step.id === 'measured'
                    ? Q_COPY.meas
                    : '';
        if (stageName) this.view.setStage(stageName);
        this.view.renderState(step);
        if (step.id === 'measured') {
          if (result.measuredInput === 0) {
            audioManager.playConstructiveSpike();
          } else {
            audioManager.playDestructiveCancel();
          }
        }
      });
    }

    this.afterDelay(3400, () => {
      this.view.showResult(result);
      this.view.setStage('DETECTOR READY');
      this.isRunning = false;
      this.view.setRunDisabled(false);
    });
  }
}
