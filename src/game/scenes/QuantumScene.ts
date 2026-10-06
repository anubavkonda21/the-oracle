import { audioManager } from '../audio/AudioManager';
import type { BooleanFunction } from '../../quantum';
import { createOracle } from '../../quantum/oracle';
import { runDeutschJozsa, type DeutschJozsaResult } from '../../quantum/deutschJozsa';
import { Q_COPY } from '../../qcopy';
import { DESIGN_WIDTH } from '../config/display';
import { MACHINE_CENTER_Y } from '../config/oracleConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { addBackdrop } from '../effects/backdrop';
import { OracleMachine } from '../entities/OracleMachine';
import { StageScene } from './StageScene';
import { createQuantumView, type QuantumView } from '../ui/views/quantumView';

export interface QuantumEntry {
  hiddenFunction: BooleanFunction;
}

export class QuantumScene extends StageScene {
  private view!: QuantumView;
  private machine!: OracleMachine;
  private hiddenFunction!: BooleanFunction;
  private hasRun = false;

  constructor() {
    super(SCENE_KEYS.quantum);
  }

  create(entry: QuantumEntry): void {
    this.hiddenFunction = entry.hiddenFunction;
    // This scene object outlives a visit. Nothing from an earlier run may carry over into this one.
    this.result = null;
    this.hasRun = false;
    this.isRunning = false;

    this.view = createQuantumView({
      onRun: () => this.runAlgorithm(),
      onNext: () => this.continueToReveal(),
    });

    this.enterStage(this.view.element, 'dark');

    // The same machine, where it stood in the laboratory — now lit by its own, different light.
    addBackdrop(this);
    this.machine = new OracleMachine(this, DESIGN_WIDTH / 2, MACHINE_CENTER_Y, 'quantum');
  }


  private isRunning = false;
  /** The result of the run that has finished in this visit, or `null` while there is none to show. */
  private result: DeutschJozsaResult | null = null;

  /** Moves on to the reveal — but only with the result of a run that has finished, in this visit. */
  private continueToReveal(): void {
    if (this.isRunning || !this.result) {
      return;
    }
    this.leaveTo(SCENE_KEYS.reveal, { result: this.result });
  }

  private runAlgorithm(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    // Until this run has finished there is no result to move on with — not even the last run's.
    this.result = null;
    this.view.setRunDisabled(true);
    this.view.setContinueAvailable(false);
    this.machine.beginRun();
    
    const oracle = createOracle(this.hiddenFunction);
    const result = runDeutschJozsa(oracle);
    
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
         // The machine is told which stage has been reached — and, at the measurement only, what was read.
         this.machine.showRunStage(step.id, step.id === 'measured' ? result.measuredLabel : undefined);
         if (step.id === 'measured') audioManager.playMeasurement();
         else audioManager.playQuantumStep(step.id);
       });
    }
    
    this.afterDelay(5500, () => {
      this.result = result;
      audioManager.playResult();
      this.view.showResult(result, !this.hasRun);
      this.view.setStage('RESULT');
      this.hasRun = true;
      this.isRunning = false;
      this.view.setRunDisabled(false);
    });
  }

}

