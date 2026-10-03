import { DESIGN_WIDTH } from '../config/display';
import { MACHINE_CENTER_Y, ORACLE_TIMING } from '../config/oracleConfig';
import { SCENE_KEYS } from '../config/sceneKeys';
import { prefersReducedMotion } from '../effects/motion';
import { OracleMachine } from '../entities/OracleMachine';
import type { OracleQuery } from '../systems/oracle/GameOracle';
import { Investigation } from '../systems/oracle/Investigation';
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
import { investigationNote } from '../systems/oracle/investigationNotes';
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
 * The laboratory: the classical investigation. The player composes a binary
 * input, asks the machine, watches it work, and reads its one-bit answer,
 * which goes on record. Then again — and the record shows, query by query,
 * how little of the input space each answer covers.
 *
 * An input that is already on record is answered from the record: the machine
 * is not asked again and no query is used.
 *
 * This scene only connects the pieces. The machine's logic and the
 * investigation's are in systems/oracle, the machine's appearance in
 * entities/OracleMachine, and the controls in ui/views/laboratoryView.
 *
 * There is no objective to complete, no conclusion for the player to submit
 * and no level progression yet. Nothing here asks the player to work out the
 * machine's rule.
 */
export class LaboratoryScene extends StageScene {
  private investigation!: Investigation;
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
    // Coming back from THE BOX, the machine, its record and the input are as they were left.
    // Coming from the main menu, everything starts fresh: an empty record and the same fixed machine.
    const resuming = entry?.resume === true && this.hasExperiment;
    if (!resuming) {
      this.investigation = new Investigation(createPrototypeOracle());
      this.binaryInput = createBinaryInput(this.investigation.inputLength);
    }
    this.hasExperiment = true;
    this.isProcessing = false;

    this.view = createLaboratoryView({
      levelNumber: 1,
      objective: 'Find out what the machine does.',
      inputLength: this.investigation.inputLength,
      onToggleBit: (index) => this.editInput(toggleBit(this.binaryInput, index)),
      onFocusBit: (index) => this.placeCursor(setCursor(this.binaryInput, index)),
      onAsk: () => this.ask(),
      onReturn: () => this.returnToMenu(),
      boxObserved: this.session.hasObservedBox,
      onOpenBox: () => this.openBox(),
    });
    this.enterStage(this.view.element);

    this.machine = new OracleMachine(this, DESIGN_WIDTH / 2, MACHINE_CENTER_Y);

    // The view and the machine are rebuilt on every entry, so an investigation under way is drawn
    // back into them as it stands, without the ceremony of each answer arriving again.
    const record = this.investigation.record;
    for (const query of record) {
      this.view.recordQuery(query, false);
    }
    const lastQuery = record[record.length - 1];
    if (lastQuery) {
      this.machine.showAnswer(lastQuery.output, false);
    }
    this.showProgress(false);
    this.drawInput();

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
    this.drawInput();
    this.view.followCursor(next);
  }

  /** Draws the input as it stands, together with what the record already holds for it. */
  private drawInput(): void {
    this.view.renderInput(this.binaryInput, this.recordedAnswer());
  }

  /**
   * The record's entry for the input as it stands, or `null` if it is untested.
   *
   * While the machine is working, the query it is working on is already in
   * the record — but its answer has not been shown yet, and must not appear
   * early. The input cannot change during that time, so it is that query's
   * input, and is treated as untested until the machine answers.
   */
  private recordedAnswer(): OracleQuery | null {
    if (this.isProcessing) {
      return null;
    }
    return this.investigation.find(toBinaryString(this.binaryInput)) ?? null;
  }

  /** Draws the counts, and whatever the laboratory has to remark at this point in the investigation. */
  private showProgress(arrive = true): void {
    const progress = this.investigation.progress;
    this.view.renderProgress(progress);
    this.view.showNote(investigationNote(progress), arrive);
  }

  private ask(): void {
    if (this.isProcessing || this.isLeavingStage) {
      return;
    }

    const outcome = this.investigation.ask(toBinaryString(this.binaryInput));
    if (outcome.kind === 'recalled') {
      // Already on record. The machine is not asked again, nothing is counted, and nothing waits.
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
    this.machine.showAnswer(query.output);
    this.view.recordQuery(query);
    this.view.setProcessing(false);
    this.isProcessing = false;
    this.showProgress();
    this.restartTyping();
  }

  /**
   * Once a question has been dealt with — answered by the machine, or found in the record — the
   * bits stay as they are, so the player can change one and ask again. Typing starts over from the
   * left, unless the keyboard is on a particular bit, in which case the cursor stays with it.
   */
  private restartTyping(): void {
    if (!this.view.inputHasFocus()) {
      this.binaryInput = setCursor(this.binaryInput, 0);
    }
    this.drawInput();
  }

  private returnToMenu(): void {
    this.leaveTo(SCENE_KEYS.mainMenu);
  }

  private openBox(): void {
    this.leaveTo(SCENE_KEYS.box);
  }
}
