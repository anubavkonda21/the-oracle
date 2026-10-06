import { formatCounter } from '../../../utils/format';
import { DESIGN_HEIGHT } from '../../config/display';
import { GAME_IDENTITY, LEVEL_COUNT } from '../../config/identity';
import { INVESTIGATION_COPY } from '../../config/investigationConfig';
import { MACHINE_CENTER_Y } from '../../config/oracleConfig';
import { PROMISE_COPY } from '../../config/promiseConfig';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import type { InvestigationProgress } from '../../systems/oracle/Investigation';
import { toBinaryString, type BinaryInputState } from '../../systems/oracle/binaryInput';
import { inputSpaceSize } from '../../systems/oracle/inputSpace';
import type { InvestigationNote } from '../../systems/oracle/investigationNotes';
import type { OracleKind } from '../../systems/oracle/oracleKind';
import { createBitInput } from '../components/bitInput';
import { createClassificationRecord, type ClassificationState } from '../components/classificationRecord';
import { createConstraintPlate } from '../components/constraintPlate';
import { createControlButton, setUnavailable } from '../components/controlButton';
import { createExperimentLog } from '../components/experimentLog';
import { createInputSpaceMap } from '../components/inputSpaceMap';
import { createPanel } from '../components/panel';
import { createStatusIndicator, setStatusLabel } from '../components/statusIndicator';
import { createElement, restartAnimation, uniqueId } from '../dom';
import { Q_COPY } from '../../../qcopy';

/** How long an announcement stays in the page: long enough for a screen reader to have picked it up. */
const ANNOUNCEMENT_LIFETIME_MS = 4000;

export interface LaboratoryViewOptions {
  /** 1-based level number shown in the progression indicator. */
  levelNumber: number;
  objective: string;
  inputLength: number;
  onToggleBit: (index: number) => void;
  onFocusBit: (index: number) => void;
  onAsk: () => void;
  onReturn: () => void;
  /** Whether the player has already observed THE BOX in this session. */
onEnterQuantumMode?: () => void;
  /** The player chose one of the two kinds of machine as their conclusion. */
  onConclude: (kind: OracleKind) => void;
}

export interface LaboratoryView {
  readonly element: HTMLElement;
  /**
   * Draws the binary input the player is composing, and what the record
   * already holds for it: the entry of the query that tested it, or `null`
   * if it is untested.
   */
  renderInput(state: BinaryInputState, recorded: OracleQuery | null): void;
  /** Moves keyboard focus to follow the typing cursor, but only if focus is already inside the input. */
  followCursor(state: BinaryInputState): void;
  /** True when keyboard focus is on one of the input's bits. */
  inputHasFocus(): boolean;
  /** While the machine is working, the input and the ask control cannot be used. */
  setProcessing(processing: boolean): void;
  /** Adds an answered query to the record: the experiment log and the input space. With `animate` off it is simply there. */
  recordQuery(query: OracleQuery, animate?: boolean): void;
  /** Draws the counts: queries used, and inputs tested and untested. */
  renderProgress(progress: InvestigationProgress): void;
  /**
   * The player asked about an input that is already on record. Points to the
   * entry and says that no query was used; the machine is not involved.
   */
  showRecalled(query: OracleQuery): void;
  /**
   * Shows the laboratory's remark on the investigation, or none. A new remark
   * arrives — it fades in and is announced — unless `arrive` is off, as when
   * the player comes back to an investigation already under way.
   */
  showNote(note: InvestigationNote | null, arrive?: boolean): void;
  /**
   * Discloses the constraint the machine is under, above the machine. It
   * arrives part by part and is announced — unless `arrive` is off, when it
   * is simply there. Until this is called, nothing of it can be seen.
   */
  revealPromise(arrive?: boolean): void;
  /**
   * Sets the task that follows from the constraint: the objective changes,
   * and the record gains the evidence that bears on it and a place for the
   * player's conclusion. This comes after the constraint, once the two kinds
   * have been described and named.
   */
  setClassificationTask(objective: string, arrive?: boolean): void;
  /**
   * Draws the evidence, the conclusion on record and how it stands. A change
   * in the conclusion or in its standing is announced, unless `announceChange`
   * is off.
   */
  renderClassification(state: ClassificationState, announceChange?: boolean): void;
}

/**
 * The laboratory interface (layout: `.laboratory` in views.css and oracle.css):
 * the input console under the machine, the map of the input space on one side
 * and the experiment log on the other, and the HUD around the edges. The
 * middle is left clear for the canvas, where the machine itself is drawn.
 *
 * Once the laboratory discloses it, the constraint the machine is under is
 * printed above the machine.
 */
export function createLaboratoryView(options: LaboratoryViewOptions): LaboratoryView {
  const { levelNumber, objective, inputLength, onToggleBit, onFocusBit, onAsk, onReturn, onConclude, onEnterQuantumMode } =
    options;
  const titleId = uniqueId('laboratory-title');
  const inputLabelId = uniqueId('input-label');
  const { title } = GAME_IDENTITY;
  const { record } = INVESTIGATION_COPY;

  const header = createElement('header', { className: 'laboratory__header' }, [
    createElement('h1', {
      className: 'wordmark',
      text: `${title.article} ${title.name}`,
      attributes: { id: titleId },
    }),
    createElement('p', {
      className: 'readout',
      text: formatCounter(levelNumber, LEVEL_COUNT),
      attributes: { 'aria-label': `Level ${levelNumber} of ${LEVEL_COUNT}` },
    }),
  ]);

  // The canvas is hidden from assistive technology, so the scene is described in words.
  const sceneDescription = createElement('p', {
    className: 'visually-hidden',
    text: 'A matte black machine with a single circular aperture stands in the centre of the laboratory. Its answer to each input appears in the aperture and in the experiment log. A map of the input space shows which of the possible inputs have been tested.',
  });

  const bitInput = createBitInput({
    length: inputLength,
    labelledBy: inputLabelId,
    onToggle: onToggleBit,
    onFocusBit,
    onSubmit: onAsk,
  });
  const askButton = createControlButton({
    label: 'ASK',
    onActivate: onAsk,
    shortcut: { label: 'ENTER', ariaKey: 'Enter' },
  });
  // What the record holds for the input as it stands. It changes with every digit, so it is not a live region.
  const recordLine = createElement('p', { className: 'readout console__record', text: record.untested });
  const inputConsole = createElement('div', { className: 'console' }, [
    createElement('p', { className: 'readout console__label', text: 'INPUT', attributes: { id: inputLabelId } }),
    bitInput.element,
    askButton,
    recordLine,
  ]);

  const noteLine = createElement('p', { className: 'laboratory__note' });

  // What is known about the machine, and what the record says about it. Both are built now and kept out of
  // sight — and out of reach of the keyboard and of screen readers — until the laboratory discloses them.
  const constraint = createConstraintPlate(inputSpaceSize(inputLength));
  constraint.element.hidden = true;
  const classificationRecord = createClassificationRecord({ onConclude });
  classificationRecord.element.hidden = true;

  const inputSpace = createInputSpaceMap(inputLength);
  const experimentLog = createExperimentLog(classificationRecord.element);
  const systemStatus = createStatusIndicator('ONLINE');
  const objectiveText = createElement('p', { className: 'panel__text', text: objective });

  // The one place a screen reader is told about things as they happen: a repeated input, and each new remark.
  const announcer = createElement('p', { className: 'visually-hidden', attributes: { role: 'status' } });

  /**
   * Says something once. The words are taken away again shortly afterwards:
   * left in the page they would go stale — the visible text they repeat moves
   * on — and would be read a second time by anyone reading the page through.
   */
  function announce(message: string): void {
    announcer.textContent = message;
    window.setTimeout(() => {
      if (announcer.textContent === message) {
        announcer.textContent = '';
      }
    }, ANNOUNCEMENT_LIFETIME_MS);
  }

  const quantumModeButton = createControlButton({
    label: Q_COPY.enter,
    variant: 'quiet',
    onActivate: () => onEnterQuantumMode?.(),
  });
  quantumModeButton.hidden = true;

  const footer = createElement('footer', { className: 'laboratory__footer' }, [
    createPanel({ heading: 'OBJECTIVE', content: [objectiveText] }),
    createElement('div', { className: 'laboratory__actions' }, [
      quantumModeButton,
      
      createControlButton({
        label: 'RETURN',
        variant: 'quiet',
        onActivate: onReturn,
        shortcut: { label: 'ESC', ariaKey: 'Escape' },
      }),
    ]),
    createPanel({ heading: 'SYSTEM STATUS', content: [systemStatus] }),
  ]);

  const element = createElement('section', { className: 'view laboratory', attributes: { 'aria-labelledby': titleId } }, [
    header,
    sceneDescription,
    createElement('div', { className: 'laboratory__constraint' }, [constraint.element]),
    createElement('div', { className: 'laboratory__console' }, [inputConsole, noteLine]),
    createElement('aside', { className: 'laboratory__space' }, [inputSpace.element]),
    createElement('aside', { className: 'laboratory__log' }, [experimentLog.element]),
    footer,
    announcer,
  ]);
  // The console sits a fixed distance below the machine, wherever the scene places the machine.
  element.style.setProperty('--machine-offset-y', String(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,

    renderInput(state, recorded) {
      bitInput.render(state);
      // The same input, seen three ways: as bits, as a place in the input space, and as an entry in the log.
      inputSpace.setCursor(toBinaryString(state));
      experimentLog.setCurrent(recorded);

      recordLine.textContent = recorded ? record.tested(recorded) : record.untested;
      recordLine.removeAttribute('data-recalled');
    },

    followCursor(state) {
      if (!bitInput.hasFocus()) {
        return;
      }
      if (state.cursor < inputLength) {
        bitInput.focusBit(state.cursor);
      } else {
        askButton.focus(); // Every bit has been typed; the next thing to do is ask.
      }
    },

    inputHasFocus() {
      return bitInput.hasFocus();
    },

    setProcessing(processing) {
      bitInput.setUnavailable(processing);
      setUnavailable(askButton, processing);
      setStatusLabel(systemStatus, processing ? 'PROCESSING' : 'ONLINE');
    },

    recordQuery(query, animate = true) {
      experimentLog.add(query);
      inputSpace.mark(query, animate);
    },

    renderProgress(progress) {
      experimentLog.renderCount(progress.queryCount);
      inputSpace.renderProgress(progress);
    },

    showRecalled(query) {
      // Two phrases, each kept whole: in a window too narrow for one line, the break falls between them.
      recordLine.replaceChildren(
        createElement('span', { text: `${record.tested(query)} ·` }),
        ' ',
        createElement('span', { text: record.noQueryUsed }),
      );
      restartAnimation(recordLine, 'data-recalled');
      experimentLog.recall(query);
      announce(record.recalledAnnouncement(query));
    },

    showNote(note, arrive = true) {
      const stage = note ? String(note.stage) : '';
      const isNewRemark = noteLine.dataset.stage !== stage;

      noteLine.dataset.stage = stage;
      noteLine.textContent = note?.text ?? '';

      // A remark whose numbers have merely kept up with the record has not arrived again.
      if (note && isNewRemark && arrive) {
        restartAnimation(noteLine, 'data-arrived');
        announce(note.text);
      }
    },

    revealPromise(arrive = true) {
      constraint.element.hidden = false;
      // The way into Quantum Mode appears with the constraint, and not before (see `.control[hidden]`).
      quantumModeButton.hidden = !onEnterQuantumMode;
      if (arrive) {
        constraint.arrive();
        announce(PROMISE_COPY.announcement);
      }
    },

    setClassificationTask(newObjective, arrive = true) {
      objectiveText.textContent = newObjective;
      classificationRecord.element.hidden = false;
      if (arrive) {
        restartAnimation(objectiveText, 'data-arrived');
        restartAnimation(classificationRecord.element, 'data-arrived');
        announce(PROMISE_COPY.objectiveAnnouncement(newObjective));
      }
    },

    renderClassification(state, announceChange = true) {
      classificationRecord.render(state);

      // What is worth saying aloud is a change in the conclusion or in how it stands — not a count that has moved on by one.
      const drawn = `${state.conclusion ?? ''}:${state.standing ?? ''}`;
      const changed = classificationRecord.element.dataset.drawn !== undefined && classificationRecord.element.dataset.drawn !== drawn;
      classificationRecord.element.dataset.drawn = drawn;

      if (changed && announceChange) {
        announce(PROMISE_COPY.conclusion.announcement(state.conclusion, state.evidence));
      }
    },
  };
}
