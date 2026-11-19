import { audioManager } from '../audio/AudioManager';
import { DESIGN_WIDTH } from '../config/display';
import { MACHINE_CENTER_Y, ORACLE_TIMING } from '../config/oracleConfig';
import { PROMISE_TIMING } from '../config/promiseConfig';
import { PROMISE_COPY } from '../config/promiseConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { prefersReducedMotion } from '../effects/motion';
import { OracleMachine } from '../entities/OracleMachine';
import { listenForKeyPresses } from '../systems/keyboard';
import {
  createBinaryInput,
  eraseBit,
  moveCursor,
  setCursor,
  toBinaryString,
  toggleBit,
  typeBit,
  type BinaryInputState,
} from '../systems/oracle/binaryInput';
import { bindInvestigationOracle, Investigation } from '../systems/oracle/Investigation';
import { Classification, promiseIsRevealed } from '../systems/oracle/Classification';
import { createPrototypeOracle } from '../systems/oracle/prototypeOracle';
import type { OracleQuery } from '../systems/oracle/GameOracle';
import type { OracleKind } from '../systems/oracle/oracleKind';
import {
  GameStateMachine,
  type ClassificationOutcome,
} from '../systems/levelProgression';
import { createLaboratoryView, type LaboratoryView } from '../ui/views/laboratoryView';
import { StageScene } from './StageScene';

export interface LaboratoryEntry {
  resume?: boolean;
  level?: number | 'endless';
}

export class LaboratoryScene extends StageScene {
  private investigation!: Investigation;
  private classification!: Classification;
  private stateMachine!: GameStateMachine;
  private machine!: OracleMachine;
  private view!: LaboratoryView;
  private binaryInput!: BinaryInputState;
  private isProcessing = false;
  private hasExperiment = false;
  private promiseShown = false;
  private timerInterval: number | null = null;
  private currentInputLength = 2;

  constructor() {
    super(SCENE_KEYS.laboratory);
  }

  create(entry?: LaboratoryEntry): void {
    audioManager.init();

    this.stateMachine = new GameStateMachine();
    if (entry?.level) {
      this.stateMachine.startLevel(entry.level);
    }

    const resuming = entry?.resume === true && this.hasExperiment;
    if (!resuming) {
      this.investigation = new Investigation(createPrototypeOracle());
      this.classification = new Classification(this.investigation);
      this.binaryInput = createBinaryInput(this.investigation.inputLength);
    }
    this.hasExperiment = true;
    this.isProcessing = false;
    this.promiseShown = false;

    const cfg = this.stateMachine.config;
    this.currentInputLength = cfg.bits;
    this.binaryInput = createBinaryInput(this.currentInputLength);

    this.view = createLaboratoryView({
      levelNumber: 1,
      levelName: cfg.name,
      objective: 'The Oracle accepts a binary input and returns a single bit. The rule is unknown.',
      inputLength: this.currentInputLength,
      streak: this.stateMachine.streak,
      targetStreak: this.stateMachine.targetStreak,
      onToggleBit: (index) => {
        audioManager.playBitToggle();
        this.editInput(toggleBit(this.binaryInput, index));
      },
      onFocusBit: (index) => this.placeCursor(setCursor(this.binaryInput, index)),
      onAsk: () => this.ask(),
      onFireQuantumProbe: () => this.fireQuantumProbe(),
      onReturn: () => this.returnToMenu(),
      onConclude: (kind) => this.conclude(kind),
      onSkipToQuantum: () => {
        this.stopTimer();
        this.isProcessing = false;
        this.stateMachine.startLevel(4);
        this.setupCurrentBoxUI();
      },
    });

    this.enterStage(this.view.element);
    this.machine = new OracleMachine(this, DESIGN_WIDTH / 2, MACHINE_CENTER_Y);

    this.setupCurrentBoxUI();
    listenForKeyPresses(this, (event) => this.handleKey(event));
  }

  private setupCurrentBoxUI(): void {
    const box = this.stateMachine.box;
    const cfg = this.stateMachine.config;

    this.isProcessing = false;
    this.view.setProcessing(false);

    bindInvestigationOracle(this.investigation, box.gameOracle);

    if (this.classification.conclusion !== null) {
      this.classification.conclude(this.classification.conclusion);
    }

    this.currentInputLength = box.oracle.bits;
    this.binaryInput = createBinaryInput(this.currentInputLength);
    this.view.resetForLength(this.currentInputLength);

    this.machine.clearAnswer();
    this.drawInput();

    this.view.renderLevelInfo(
      cfg.name,
      this.stateMachine.streak,
      this.stateMachine.targetStreak,
      box.timeRemaining,
    );

    this.view.renderProgress(this.investigation.progress, box.queriesLeft);
    this.view.updateTally(box.tally.zeros, box.tally.ones);
    this.view.setQuantumProbeAvailable(this.stateMachine.canFireQuantum, box.quantumQueriesLeft);
    this.view.setPulseClassify(box.queriesLeft <= 0);

    this.stopTimer();
    if (cfg.timeLimitSeconds && !box.isResolved) {
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const box = this.stateMachine.box;

    this.timerInterval = window.setInterval(() => {
      if (this.isLeavingStage || box.isResolved) {
        this.stopTimer();
        return;
      }

      if (box.timeRemaining !== null && box.timeRemaining > 0) {
        box.timeRemaining -= 1;
        this.view.renderLevelInfo(
          this.stateMachine.config.name,
          this.stateMachine.streak,
          this.stateMachine.targetStreak,
          box.timeRemaining,
        );

        if (box.timeRemaining <= 0) {
          this.stopTimer();
          this.handleTimeout();
        }
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.repeat && event.key !== '0' && event.key !== '1' && event.key !== 'Backspace') {
      return;
    }

    switch (event.key) {
      case '0':
        audioManager.playBitToggle();
        this.editInput(typeBit(this.binaryInput, 0));
        break;
      case '1':
        audioManager.playBitToggle();
        this.editInput(typeBit(this.binaryInput, 1));
        break;
      case 'Backspace':
        this.editInput(eraseBit(this.binaryInput));
        break;
      case 'ArrowLeft':
        this.placeCursor(moveCursor(this.binaryInput, -1));
        break;
      case 'ArrowRight':
        this.placeCursor(moveCursor(this.binaryInput, 1));
        break;
      case 'Enter':
        if (!(document.activeElement instanceof HTMLButtonElement)) {
          this.ask();
        }
        break;
      case 'Escape':
        this.returnToMenu();
        break;
    }
  }

  private editInput(next: BinaryInputState): void {
    if (!this.isProcessing) {
      this.placeCursor(next);
    }
  }

  private placeCursor(next: BinaryInputState): void {
    if (this.isLeavingStage || next === this.binaryInput) {
      return;
    }
    this.binaryInput = next;
    this.drawInput();
    this.view.followCursor(next);
  }

  private drawInput(): void {
    const inputStr = toBinaryString(this.binaryInput).padStart(this.currentInputLength, '0');
    const recorded = this.investigation.find(inputStr) ?? null;
    this.view.renderInput(this.binaryInput, recorded);
  }

  private showProgress(arrive = true): void {
    const box = this.stateMachine.box;
    const progress = this.investigation.progress;

    this.view.renderProgress(progress, box.queriesLeft);
    this.view.updateTally(box.tally.zeros, box.tally.ones);
    this.drawClassification(arrive);

    if (promiseIsRevealed(progress) && !this.promiseShown) {
      this.promiseShown = true;
      this.disclosePromise(arrive);
    }
  }

  private disclosePromise(arrive: boolean): void {
    this.view.revealPromise(arrive);
    if (!arrive) {
      this.view.setClassificationTask(PROMISE_COPY.objective, false);
      return;
    }
    const wait = prefersReducedMotion() ? PROMISE_TIMING.reducedMotionObjectiveDelayMs : PROMISE_TIMING.objectiveDelayMs;
    this.afterDelay(wait, () => this.view.setClassificationTask(PROMISE_COPY.objective));
  }

  private drawClassification(announceChange = true): void {
    this.view.renderClassification(
      {
        evidence: this.classification.evidence,
        conclusion: this.classification.conclusion,
        standing: this.classification.standing,
      },
      announceChange,
    );
  }

  private ask(): void {
    if (this.isProcessing || this.isLeavingStage) {
      return;
    }

    const box = this.stateMachine.box;
    if (box.queriesLeft <= 0) {
      this.view.setPulseClassify(true);
      return;
    }

    const inputStr = toBinaryString(this.binaryInput).padStart(this.currentInputLength, '0');
    const outcome = this.investigation.ask(inputStr);
    if (outcome.kind === 'recalled') {
      this.restartTyping();
      this.view.showRecalled(outcome.query);
      return;
    }
    const { query } = outcome;

    this.isProcessing = true;
    this.view.setProcessing(true);
    this.machine.startProcessing();

    const wait = prefersReducedMotion() ? ORACLE_TIMING.reducedMotionProcessingMs : ORACLE_TIMING.processingMs;
    this.afterDelay(wait, () => this.answer(query));
  }

  private answer(query: OracleQuery): void {
    this.stateMachine.recordQuery(query);

    this.machine.showAnswer(query.output);
    this.view.recordQuery(query);
    this.view.setProcessing(false);
    this.isProcessing = false;
    this.showProgress();

    if (this.stateMachine.box.queriesLeft <= 0) {
      this.view.setPulseClassify(true);
    }

    this.restartTyping();
  }

  private restartTyping(): void {
    if (!this.view.inputHasFocus()) {
      this.binaryInput = setCursor(this.binaryInput, 0);
    }
    this.drawInput();
  }

  private fireQuantumProbe(): void {
    if (this.isProcessing || this.isLeavingStage || !this.stateMachine.canFireQuantum) {
      return;
    }

    this.isProcessing = true;
    this.view.setProcessing(true);
    this.view.setSuperpositionGrid(true);
    audioManager.playQuantumProbeSweep();

    const probeResult = this.stateMachine.fireQuantumProbe();
    const isConstant = probeResult.isZeroDetectorLit;

    this.machine.playQuantumInterferenceAnimation(isConstant, probeResult.measuredLabel, () => {
      this.view.setSuperpositionGrid(false);
      this.view.setProcessing(false);
      this.isProcessing = false;

      if (isConstant) {
        audioManager.playConstructiveSpike();
      } else {
        audioManager.playDestructiveCancel();
      }

      this.view.showDetectorReadout(probeResult.detectorStatus);
      this.view.setQuantumProbeAvailable(false, 0);
      this.view.setPulseClassify(true);
    });
  }

  private conclude(kind: OracleKind): void {
    if (this.isProcessing || this.isLeavingStage) {
      return;
    }

    this.classification.conclude(kind);
    this.drawClassification();

    this.stopTimer();
    const outcome = this.stateMachine.classify(kind);

    if (outcome.correct) {
      this.handleCorrectClassification(outcome);
    } else {
      this.handleWrongClassification(outcome);
    }
  }

  private handleCorrectClassification(outcome: ClassificationOutcome): void {
    audioManager.playChime();
    this.view.flashCorrect();

    if (outcome.levelCompleted) {
      audioManager.playLevelClear();

      if (this.stateMachine.levelNumber === 3) {
        this.view.showDetectorReadout('CLASSICAL LIMIT REACHED — QUANTUM PROBE UNLOCKED');
        this.afterDelay(1400, () => {
          this.stateMachine.startLevel(4);
          this.setupCurrentBoxUI();
        });
        return;
      }

      if (this.stateMachine.levelNumber === 5) {
        this.afterDelay(1200, () => {
          this.leaveTo(SCENE_KEYS.reveal);
        });
        return;
      }

      this.afterDelay(800, () => {
        this.stateMachine.startLevel(outcome.nextLevel);
        this.setupCurrentBoxUI();
      });
    } else {
      this.afterDelay(600, () => {
        this.stateMachine.nextBox();
        this.setupCurrentBoxUI();
      });
    }
  }

  private handleWrongClassification(outcome: ClassificationOutcome): void {
    this.cameras.main.shake(150, 0.015);
    audioManager.playWrongBuzzer();

    if (outcome.fullGridMap) {
      this.view.revealAllGrid(outcome.fullGridMap);
    }

    this.isProcessing = true;
    this.view.setProcessing(true);

    this.afterDelay(1500, () => {
      this.isProcessing = false;
      this.view.setProcessing(false);
      this.stateMachine.nextBox();
      this.setupCurrentBoxUI();
    });
  }

  private handleTimeout(): void {
    const outcome = this.stateMachine.handleTimeout();
    this.handleWrongClassification(outcome);
  }

  private returnToMenu(): void {
    this.stopTimer();
    this.leaveTo(SCENE_KEYS.mainMenu);
  }
}
