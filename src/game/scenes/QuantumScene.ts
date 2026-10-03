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
  private hasRun = false;

  constructor() {
    super(SCENE_KEYS.quantum);
  }

  create(entry: QuantumEntry): void {
    this.hiddenFunction = entry.hiddenFunction;

    this.view = createQuantumView({
      onRun: () => this.runAlgorithm(),
      onNext: () => this.leaveTo(SCENE_KEYS.reveal, { result: this.result }),
    });

    this.enterStage(this.view.element, 'dark');
  }


  private isRunning = false;
  private result: any = null;

  private runAlgorithm(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.view.setRunDisabled(true);
    
    const oracle = createOracle(this.hiddenFunction);
    const result = runDeutschJozsa(oracle);
    this.result = result;
    
    const steps = result.steps;
    const delays: Record<string, number> = {
      'prepared': 500,
      'superposed': 1500,
      'ancilla-ready': 1500,
      'queried': 2500,
      'interfered': 3500,
      'measured': 4500,
    };
    
    for (const step of steps) {
       const d = delays[step.id] || 0;
       this.afterDelay(d, () => {
         const stageName = step.id === 'prepared' ? Q_COPY.prep : step.id === 'superposed' ? Q_COPY.sup : step.id === 'queried' ? Q_COPY.or : step.id === 'interfered' ? Q_COPY.inter : step.id === 'measured' ? Q_COPY.meas : '';
         if (stageName) this.view.setStage(stageName);
         this.view.renderState(step);
       });
    }
    
    this.afterDelay(5500, () => {
      this.view.showResult(result, !this.hasRun);
      this.view.setStage('RESULT');
      this.hasRun = true;
      this.isRunning = false;
      this.view.setRunDisabled(false);
    });
  }

}

