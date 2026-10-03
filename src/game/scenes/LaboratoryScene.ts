import { DESIGN_WIDTH } from '../config/display';
import { MACHINE_CENTER_Y, ORACLE_TIMING } from '../config/oracleConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { prefersReducedMotion } from '../effects/motion';
import { OracleMachine } from '../entities/OracleMachine';
import type { GameOracle, OracleQuery } from '../systems/oracle/GameOracle';
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
import { listenForKeyPresses } from '../systems/keyboard';
import { createPrototypeOracle } from '../systems/oracle/prototypeOracle';
import { createLaboratoryView, type LaboratoryView } from '../ui/views/laboratoryView';
import { StageScene } from './StageScene';

/** What another scene can hand the laboratory when it starts it. */
interface LaboratoryEntry {
  /** Continue the experiment that was under way, rather than starting a new one. */
  resume?: boolean;
}

/**
 * The laboratory: the first playable loop. The player composes a binary
 * input, asks the machine, watches it work, and reads its one-bit answer,
 * which is added to the experiment log. Then again.
 *
 * This scene only connects the pieces. The machine's logic is in
 * systems/oracle, its appearance in entities/OracleMachine, and the controls
 * in ui/views/laboratoryView.
 *
 * PROTOTYPE: there is no objective to complete, no conclusion for the player
 * to submit and no level progression yet.
 */
export class LaboratoryScene extends StageScene {
  private oracle!: GameOracle;
  private machine!: OracleMachine;
  private view!: LaboratoryView;
  private binaryInput!: BinaryInputState;
  private isProcessing = false;
  /** False until the laboratory has been entered once, after which there is an experiment to resume. */
  private hasExperiment = false;

  constructor() {
    super(SCENE_KEYS.laboratory);
  }

  create(entry?: LaboratoryEntry): void {
    // Coming back from THE BOX, the machine, its log and the input are as they were left.
    // Coming from the main menu, everything starts fresh: an empty log and the same fixed behaviour.
    const resuming = entry?.resume === true && this.hasExperiment;
    if (!resuming) {
      this.oracle = createPrototypeOracle();
      this.binaryInput = createBinaryInput(this.oracle.inputLength);
    }
    this.hasExperiment = true;
    this.isProcessing = false;

    this.view = createLaboratoryView({
      levelNumber: 1,
      objective: 'Find out what the machine does.',
      inputLength: this.oracle.inputLength,
      onToggleBit: (index) => this.editInput(toggleBit(this.binaryInput, index)),
      onFocusBit: (index) => this.placeCursor(setCursor(this.binaryInput, index)),
      onAsk: () => this.ask(),
      onReturn: () => this.returnToMenu(),
      boxObserved: this.session.hasObservedBox,
      onOpenBox: () => this.openBox(),
    });
    this.enterStage(this.view.element);
    this.view.renderInput(this.binaryInput);

    this.machine = new OracleMachine(this, DESIGN_WIDTH / 2, MACHINE_CENTER_Y);

    // The view and the machine are rebuilt on every entry, so a resumed experiment is drawn back into them.
    const history = this.oracle.history;
    for (const query of history) {
      this.view.recordQuery(query);
    }
    const lastQuery = history[history.length - 1];
    if (lastQuery) {
      this.machine.showAnswer(lastQuery.output, false);
    }

    listenForKeyPresses(this, (event) => this.handleKey(event));
  }

  private handleKey(event: KeyboardEvent): void {
    // Holding a digit down fills in bits, as it would in any text field. Holding any other key
    // must not act again and again — least of all an Enter still held from the main menu.
    if (event.repeat && event.key !== '0' && event.key !== '1' && event.key !== 'Backspace') {
      return;
    }

    switch (event.key) {
      case '0':
        this.editInput(typeBit(this.binaryInput, 0));
        break;
      case '1':
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
        // When a button has focus, Enter already presses that button. Asking here as well would
        // submit a query the player did not intend — for example while pressing RETURN.
        if (!(document.activeElement instanceof HTMLButtonElement)) {
          this.ask();
        }
        break;
      case 'Escape':
        this.returnToMenu();
        break;
      case 'b':
      case 'B':
        this.openBox();
        break;
    }
  }

  /** Changes the value of the input. Ignored while the machine is busy with the previous one. */
  private editInput(next: BinaryInputState): void {
    if (!this.isProcessing) {
      this.placeCursor(next);
    }
  }

  /** Adopts a new input state and redraws it. Used directly for cursor moves, which are harmless at any time. */
  private placeCursor(next: BinaryInputState): void {
    if (this.isLeavingStage || next === this.binaryInput) {
      return;
    }
    this.binaryInput = next;
    this.view.renderInput(next);
    this.view.followCursor(next);
  }

  private ask(): void {
    if (this.isProcessing || this.isLeavingStage) {
      return;
    }
    const query = this.oracle.query(toBinaryString(this.binaryInput));

    this.isProcessing = true;
    this.view.setProcessing(true);
    this.machine.startProcessing();

    const wait = prefersReducedMotion() ? ORACLE_TIMING.reducedMotionProcessingMs : ORACLE_TIMING.processingMs;
    this.afterDelay(wait, () => this.answer(query));
  }

  private answer(query: OracleQuery): void {
    this.machine.showAnswer(query.output);
    this.view.recordQuery(query);
    this.view.setProcessing(false);
    this.isProcessing = false;

    // The bits stay as they are, so the player can change one and ask again. Typing starts over from
    // the left — unless the keyboard is on a particular bit, in which case the cursor stays with it.
    if (!this.view.inputHasFocus()) {
      this.binaryInput = setCursor(this.binaryInput, 0);
    }
    this.view.renderInput(this.binaryInput);
  }

  private returnToMenu(): void {
    this.leaveTo(SCENE_KEYS.mainMenu);
  }

  private openBox(): void {
    this.leaveTo(SCENE_KEYS.box);
  }
}
