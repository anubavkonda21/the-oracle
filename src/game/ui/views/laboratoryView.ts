import { formatCounter } from '../../../utils/format';
import { DESIGN_HEIGHT } from '../../config/display';
import { GAME_IDENTITY, LEVEL_COUNT } from '../../config/identity';
import { MACHINE_CENTER_Y } from '../../config/oracleConfig';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import type { BinaryInputState } from '../../systems/oracle/binaryInput';
import { createBitInput } from '../components/bitInput';
import { createControlButton, setUnavailable } from '../components/controlButton';
import { createExperimentLog } from '../components/experimentLog';
import { createPanel } from '../components/panel';
import { createStatusIndicator, setStatusLabel } from '../components/statusIndicator';
import { createElement, uniqueId } from '../dom';

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
  boxObserved: boolean;
  onOpenBox: () => void;
}

export interface LaboratoryView {
  readonly element: HTMLElement;
  /** Draws the binary input the player is composing. */
  renderInput(state: BinaryInputState): void;
  /** Moves keyboard focus to follow the typing cursor, but only if focus is already inside the input. */
  followCursor(state: BinaryInputState): void;
  /** True when keyboard focus is on one of the input's bits. */
  inputHasFocus(): boolean;
  /** While the machine is working, the input and the ask control cannot be used. */
  setProcessing(processing: boolean): void;
  /** Adds an answered query to the experiment log. */
  recordQuery(query: OracleQuery): void;
}

/**
 * The laboratory interface (layout: `.laboratory` in views.css and oracle.css):
 * the input console under the machine, the experiment log beside it, and the
 * HUD around the edges. The middle is left clear for the canvas, where the
 * machine itself is drawn.
 */
export function createLaboratoryView(options: LaboratoryViewOptions): LaboratoryView {
  const { levelNumber, objective, inputLength, onToggleBit, onFocusBit, onAsk, onReturn, boxObserved, onOpenBox } = options;
  const titleId = uniqueId('laboratory-title');
  const inputLabelId = uniqueId('input-label');
  const { title } = GAME_IDENTITY;

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
    text: 'A matte black machine with a single circular aperture stands in the centre of the laboratory. Its answer to each input appears in the aperture and in the experiment log.',
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
  const inputConsole = createElement('div', { className: 'console' }, [
    createElement('p', { className: 'readout console__label', text: 'INPUT', attributes: { id: inputLabelId } }),
    bitInput.element,
    askButton,
  ]);

  const experimentLog = createExperimentLog();
  const systemStatus = createStatusIndicator('ONLINE');

  const footer = createElement('footer', { className: 'laboratory__footer' }, [
    createPanel({
      heading: 'OBJECTIVE',
      content: [createElement('p', { className: 'panel__text', text: objective })],
    }),
    createElement('div', { className: 'laboratory__actions' }, [
      // The other apparatus in the facility. Once it has been observed, the control says so in place of its key hint.
      createControlButton({
        label: 'THE BOX',
        variant: 'quiet',
        onActivate: onOpenBox,
        shortcut: { label: boxObserved ? 'OBSERVED' : 'B', ariaKey: 'B' },
      }),
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
    createElement('div', { className: 'laboratory__console' }, [inputConsole]),
    createElement('aside', { className: 'laboratory__log' }, [experimentLog.element]),
    footer,
  ]);
  // The console sits a fixed distance below the machine, wherever the scene places the machine.
  element.style.setProperty('--machine-offset-y', String(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,

    renderInput(state) {
      bitInput.render(state);
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

    recordQuery(query) {
      experimentLog.add(query);
    },
  };
}
