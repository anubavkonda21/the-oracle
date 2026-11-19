import { audioManager } from '../../audio/AudioManager';
import { DESIGN_HEIGHT } from '../../config/display';
import { GAME_IDENTITY } from '../../config/identity';
import { INVESTIGATION_COPY } from '../../config/investigationConfig';
import { MACHINE_CENTER_Y } from '../../config/oracleConfig';
import { PROMISE_COPY } from '../../config/promiseConfig';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import type { InvestigationProgress } from '../../systems/oracle/Investigation';
import { toBinaryString, type BinaryInputState } from '../../systems/oracle/binaryInput';
import { inputSpaceSize } from '../../systems/oracle/inputSpace';
import type { InvestigationNote } from '../../systems/oracle/investigationNotes';
import { ORACLE_KINDS, type OracleKind } from '../../systems/oracle/oracleKind';
import { createBitInput, type BitInput } from '../components/bitInput';
import { createClassificationRecord, type ClassificationState } from '../components/classificationRecord';
import { createConstraintPlate } from '../components/constraintPlate';
import { createControlButton, setUnavailable } from '../components/controlButton';
import { createExperimentLog, type ExperimentLog } from '../components/experimentLog';
import { createInputSpaceMap, type InputSpaceMap } from '../components/inputSpaceMap';
import { createPanel } from '../components/panel';
import { createStatusIndicator, setStatusLabel } from '../components/statusIndicator';
import { createElement, restartAnimation, uniqueId } from '../dom';
import type { Bit } from '../../../quantum';

const ANNOUNCEMENT_LIFETIME_MS = 4000;

export interface LaboratoryViewOptions {
  levelNumber: number | string;
  levelName: string;
  objective: string;
  inputLength: number;
  streak: number;
  targetStreak: number;
  onToggleBit: (index: number) => void;
  onFocusBit: (index: number) => void;
  onAsk: () => void;
  onFireQuantumProbe: () => void;
  onReturn: () => void;
  onConclude: (kind: OracleKind) => void;
}

export interface LaboratoryView {
  readonly element: HTMLElement;
  renderInput(state: BinaryInputState, recorded: OracleQuery | null): void;
  followCursor(state: BinaryInputState): void;
  inputHasFocus(): boolean;
  setProcessing(processing: boolean): void;
  recordQuery(query: OracleQuery, animate?: boolean): void;
  renderProgress(progress: InvestigationProgress, queriesLeft?: number): void;
  updateTally(zeros: number, ones: number): void;
  showRecalled(query: OracleQuery): void;
  showNote(note: InvestigationNote | null, arrive?: boolean): void;
  revealPromise(arrive?: boolean): void;
  setClassificationTask(objective: string, arrive?: boolean): void;
  renderClassification(state: ClassificationState, announceChange?: boolean): void;
  showDetectorReadout(text: string): void;
  setQuantumProbeAvailable(available: boolean, queriesLeft: number): void;
  setPulseClassify(pulse: boolean): void;
  renderLevelInfo(levelName: string, streak: number, targetStreak: number, timer?: number | null): void;
  flashCorrect(): void;
  revealAllGrid(outputs: Bit[]): void;
  setSuperpositionGrid(active: boolean): void;
  resetForLength(newLength: number): void;
  clearLog(): void;
}

export function createLaboratoryView(options: LaboratoryViewOptions): LaboratoryView {
  const {
    levelName,
    objective,
    inputLength,
    streak,
    targetStreak,
    onToggleBit,
    onFocusBit,
    onAsk,
    onFireQuantumProbe,
    onReturn,
    onConclude,
  } = options;

  let currentLength = inputLength;
  const titleId = uniqueId('laboratory-title');
  const inputLabelId = uniqueId('input-label');
  const { title } = GAME_IDENTITY;
  const { record } = INVESTIGATION_COPY;

  const levelText = createElement('p', {
    className: 'readout',
    text: `${levelName} | STREAK: ${streak}/${targetStreak === Infinity ? '∞' : targetStreak}`,
  });

  const timerText = createElement('span', { className: 'timer-readout', text: '' });
  timerText.style.display = 'none';

  const muteBtn = createElement('button', {
    className: 'mute-btn',
    text: audioManager.isMuted ? 'SOUND: OFF' : 'SOUND: ON',
    attributes: { type: 'button', 'aria-label': 'Toggle audio mute' },
  });
  muteBtn.addEventListener('click', () => {
    const isMuted = audioManager.toggleMute();
    muteBtn.textContent = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
  });

  const header = createElement('header', { className: 'laboratory__header' }, [
    createElement('h1', {
      className: 'wordmark',
      text: `${title.article} ${title.name}`,
      attributes: { id: titleId },
    }),
    createElement('div', { attributes: { style: 'display: flex; align-items: center; gap: 1rem;' } }, [
      levelText,
      timerText,
      muteBtn,
    ]),
  ]);

  const sceneDescription = createElement('p', {
    className: 'visually-hidden',
    text: 'A matte black machine with a circular aperture stands in the centre of the laboratory. The Oracle accepts a binary input and returns a single bit. The rule is unknown.',
  });

  let bitInput: BitInput = createBitInput({
    length: currentLength,
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

  const quantumProbeButton = createControlButton({
    label: 'FIRE QUANTUM PROBE',
    variant: 'quiet',
    onActivate: onFireQuantumProbe,
  });
  quantumProbeButton.style.display = 'none';

  const detectorReadout = createElement('p', { className: 'detector-readout', text: '' });
  detectorReadout.style.display = 'none';

  const recordLine = createElement('p', { className: 'readout console__record', text: record.untested });
  const inputConsole = createElement('div', { className: 'console' }, [
    createElement('p', { className: 'readout console__label', text: 'INPUT', attributes: { id: inputLabelId } }),
    bitInput.element,
    askButton,
    quantumProbeButton,
    recordLine,
    detectorReadout,
  ]);

  const noteLine = createElement('p', { className: 'laboratory__note' });

  // Constraint and classification record
  const constraint = createConstraintPlate(inputSpaceSize(inputLength));
  constraint.element.hidden = true;
  const classificationRecord = createClassificationRecord({ onConclude });
  classificationRecord.element.hidden = true;

  let inputSpace: InputSpaceMap = createInputSpaceMap(currentLength);
  const experimentLog: ExperimentLog = createExperimentLog(classificationRecord.element);
  const systemStatus = createStatusIndicator('ONLINE');
  const objectiveText = createElement('p', { className: 'panel__text', text: objective });

  const announcer = createElement('p', { className: 'visually-hidden', attributes: { role: 'status' } });

  function announce(message: string): void {
    announcer.textContent = message;
    window.setTimeout(() => {
      if (announcer.textContent === message) {
        announcer.textContent = '';
      }
    }, ANNOUNCEMENT_LIFETIME_MS);
  }

  // Two permanent decision controls at the bottom using ORACLE_KINDS
  const kind0 = ORACLE_KINDS[0];
  const kind1 = ORACLE_KINDS[1];

  const classifyBtn0 = createControlButton({
    label: 'CLASSIFY: ' + PROMISE_COPY.rules[kind0].name,
    variant: 'primary',
    onActivate: () => onConclude(kind0),
  });
  classifyBtn0.classList.add('classify-btn-0');

  const classifyBtn1 = createControlButton({
    label: 'CLASSIFY: ' + PROMISE_COPY.rules[kind1].name,
    variant: 'primary',
    onActivate: () => onConclude(kind1),
  });
  classifyBtn1.classList.add('classify-btn-1');

  const classificationActions = createElement('div', { className: 'classification-actions' }, [
    classifyBtn0,
    classifyBtn1,
  ]);

  const footer = createElement('footer', { className: 'laboratory__footer' }, [
    createPanel({ heading: 'OBJECTIVE', content: [objectiveText] }),
    createElement('div', { className: 'laboratory__actions' }, [
      classificationActions,
      createControlButton({
        label: 'RETURN',
        variant: 'quiet',
        onActivate: onReturn,
        shortcut: { label: 'ESC', ariaKey: 'Escape' },
      }),
    ]),
    createPanel({ heading: 'SYSTEM STATUS', content: [systemStatus] }),
  ]);

  const spaceContainer = createElement('aside', { className: 'laboratory__space' }, [inputSpace.element]);

  const element = createElement('section', { className: 'view laboratory', attributes: { 'aria-labelledby': titleId } }, [
    header,
    sceneDescription,
    createElement('div', { className: 'laboratory__constraint' }, [constraint.element]),
    createElement('div', { className: 'laboratory__console' }, [inputConsole, noteLine]),
    spaceContainer,
    createElement('aside', { className: 'laboratory__log' }, [experimentLog.element]),
    footer,
    announcer,
  ]);

  element.style.setProperty('--machine-offset-y', String(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,

    renderInput(state, recorded) {
      bitInput.render(state);
      inputSpace.setCursor(toBinaryString(state));
      experimentLog.setCurrent(recorded);

      recordLine.textContent = recorded ? record.tested(recorded) : record.untested;
      recordLine.removeAttribute('data-recalled');
    },

    followCursor(state) {
      if (!bitInput.hasFocus()) return;
      if (state.cursor < currentLength) {
        bitInput.focusBit(state.cursor);
      } else {
        askButton.focus();
      }
    },

    inputHasFocus() {
      return bitInput.hasFocus();
    },

    setProcessing(processing) {
      bitInput.setUnavailable(processing);
      setUnavailable(askButton, processing);
      setUnavailable(quantumProbeButton, processing);
      setStatusLabel(systemStatus, processing ? 'PROCESSING' : 'ONLINE');
    },

    recordQuery(query, animate = true) {
      experimentLog.add(query);
      inputSpace.mark(query, animate);
    },

    renderProgress(progress, queriesLeft = 0) {
      experimentLog.renderCount(queriesLeft);
      inputSpace.renderProgress(progress);
    },

    updateTally(zeros, ones) {
      experimentLog.updateTally(zeros, ones);
    },

    showRecalled(query) {
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

      if (note && isNewRemark && arrive) {
        restartAnimation(noteLine, 'data-arrived');
        announce(note.text);
      }
    },

    revealPromise(arrive = true) {
      constraint.element.hidden = false;
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
      const drawn = `${state.conclusion ?? ''}:${state.standing ?? ''}`;
      const changed = classificationRecord.element.dataset.drawn !== undefined && classificationRecord.element.dataset.drawn !== drawn;
      classificationRecord.element.dataset.drawn = drawn;

      if (changed && announceChange) {
        announce(PROMISE_COPY.conclusion.announcement(state.conclusion, state.evidence));
      }
    },

    showDetectorReadout(text) {
      detectorReadout.textContent = text;
      detectorReadout.style.display = text ? 'block' : 'none';
      if (text) {
        announce(text);
      }
    },

    setQuantumProbeAvailable(available, queriesLeft) {
      quantumProbeButton.style.display = available ? 'inline-block' : 'none';
      if (available) {
        setUnavailable(quantumProbeButton, queriesLeft <= 0);
        quantumProbeButton.querySelector('.control__label')!.textContent =
          queriesLeft > 0 ? 'FIRE QUANTUM PROBE' : 'PROBE EXHAUSTED';
      }
    },

    setPulseClassify(pulse) {
      if (pulse) {
        classifyBtn0.classList.add('pulse-attention');
        classifyBtn1.classList.add('pulse-attention');
        setUnavailable(askButton, true);
      } else {
        classifyBtn0.classList.remove('pulse-attention');
        classifyBtn1.classList.remove('pulse-attention');
      }
    },

    renderLevelInfo(name, currentStreak, goalStreak, timer) {
      levelText.textContent = `${name} | STREAK: ${currentStreak}/${goalStreak === Infinity ? '∞' : goalStreak}`;
      if (timer !== null && timer !== undefined) {
        timerText.style.display = 'inline-block';
        timerText.textContent = `TIME: ${timer}s`;
      } else {
        timerText.style.display = 'none';
      }
    },

    flashCorrect() {
      const flash = createElement('div', { className: 'flash-correct' });
      element.appendChild(flash);
      setTimeout(() => flash.remove(), 400);
    },

    revealAllGrid(outputs) {
      inputSpace.revealAll(outputs);
    },

    setSuperpositionGrid(active) {
      inputSpace.setSuperposition(active);
    },

    resetForLength(newLength) {
      currentLength = newLength;
      bitInput.element.remove();

      bitInput = createBitInput({
        length: currentLength,
        labelledBy: inputLabelId,
        onToggle: onToggleBit,
        onFocusBit,
        onSubmit: onAsk,
      });

      inputConsole.insertBefore(bitInput.element, askButton);
      inputSpace.reset(currentLength);
      experimentLog.clear();
      detectorReadout.style.display = 'none';
      detectorReadout.textContent = '';
      this.setPulseClassify(false);
    },

    clearLog() {
      experimentLog.clear();
      inputSpace.reset(currentLength);
      detectorReadout.style.display = 'none';
      detectorReadout.textContent = '';
      this.setPulseClassify(false);
    },
  };
}
