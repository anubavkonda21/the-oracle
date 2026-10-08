import { createElement } from '../dom';
import { createControlButton, setUnavailable } from '../components/controlButton';
import { createPanel } from '../components/panel';
import type { DeutschJozsaResult } from '../../../quantum/deutschJozsa';
import { Q_COPY } from '../../../qcopy';
import { formatCounter } from '../../../utils/format';
import { DESIGN_HEIGHT } from '../../config/display';
import { MACHINE_CENTER_Y } from '../../config/oracleConfig';

export interface QuantumViewOptions {
  onRun: () => void;
  onNext: () => void;
}

export interface QuantumView {
  readonly element: HTMLElement;
  showResult(result: DeutschJozsaResult, isFirstRun: boolean): void;
  setStage(stage: string): void;
  setRunDisabled(disabled: boolean): void;
  /** Whether the way on to the reveal is offered. It is not, until a run has finished. */
  setContinueAvailable(available: boolean): void;
}

/**
 * The stages of a run, in the order they are reached and by the names the scene gives them (see
 * QuantumScene). They are the same for every machine: where a run has got to says nothing of what
 * it will find.
 */
const RUN_STAGES: readonly string[] = [Q_COPY.prep, Q_COPY.sup, Q_COPY.or, Q_COPY.inter, Q_COPY.meas];

/** How a stage stands, in words, for anyone who cannot see its mark. */
const STAGE_STANDING = { pending: 'not reached', current: 'in progress', done: 'done' } as const;
type StageStanding = keyof typeof STAGE_STANDING;

export function createQuantumView({ onRun, onNext }: QuantumViewOptions): QuantumView {
  const resultContainer = createElement('div', { className: 'q-result', attributes: { role: 'status' } }, [
    createElement('p', { className: 'q-result__empty', text: 'NO MEASUREMENT RECORDED' }),
  ]);
  const stageLabel = createElement('h2', { className: 'q-stage', text: 'READY' });
  const explanation = createElement('div', { className: 'q-explanation' });

  // How far the run has got: the stages in order, each marked as reached, in progress or still to come.
  const stages = RUN_STAGES.map((name, index) => {
    const standing = createElement('span', { className: 'visually-hidden' });
    const element = createElement('li', { className: 'q-sequence__stage' }, [
      createElement('span', { className: 'q-sequence__index', text: String(index + 1).padStart(2, '0'), attributes: { 'aria-hidden': 'true' } }),
      createElement('span', { className: 'q-sequence__mark', attributes: { 'aria-hidden': 'true' } }),
      createElement('span', { className: 'q-sequence__name', text: name }),
      standing,
    ]);
    return { element, standing };
  });
  const sequenceState = createElement('span', { text: 'SEQUENCE' });
  const sequenceCount = createElement('span');

  /** Draws the sequence with `reached` stages behind it (0 is none); the last of them is in progress unless the run is `complete`. */
  function renderSequence(reached: number, complete = false): void {
    stages.forEach(({ element, standing }, index) => {
      const state: StageStanding = index < reached - 1 || (complete && index < reached) ? 'done' : index === reached - 1 ? 'current' : 'pending';
      element.dataset.state = state;
      standing.textContent = `, ${STAGE_STANDING[state]}`;
      if (state === 'current') {
        element.setAttribute('aria-current', 'step');
      } else {
        element.removeAttribute('aria-current');
      }
    });
    sequenceState.textContent = complete ? 'COMPLETE' : 'SEQUENCE';
    sequenceCount.textContent = formatCounter(reached, stages.length);
  }
  renderSequence(0);

  const runButton = createControlButton({
    label: Q_COPY.run,
    onActivate: onRun,
  });
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
  });
  nextButton.hidden = true;

  // The run itself is seen on the machine, which stands in the middle of the stage, and nothing is
  // printed over it. The name of the stage is above it. To one side is how far the run has got; to
  // the other what it read; and beneath, what to make of that.
  const element = createElement('section', { className: 'view q-view' }, [
    createElement('header', { className: 'view__header q-header' }, [
      createElement('h1', { className: 'wordmark', text: Q_COPY.mode }),
      createElement('p', { className: 'readout q-count' }, [sequenceState, sequenceCount]),
    ]),
    stageLabel,
    createElement('div', { className: 'view__desk q-desk' }, [
      createElement('div', { className: 'view__body q-body' }, [
        createElement('div', { className: 'q-sequence' }, [
          createPanel({ heading: 'RUN SEQUENCE', content: [createElement('ol', { className: 'q-sequence__stages', attributes: { role: 'list' } }, stages.map((stage) => stage.element))] }),
        ]),
        createElement('div', { className: 'q-readout' }, [createPanel({ heading: 'READOUT', content: [resultContainer] })]),
        explanation,
      ]),
      createElement('div', { className: 'view__actions q-actions' }, [runButton, nextButton]),
    ]),
  ]);
  element.style.setProperty('--machine-offset-y', String(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,
    setStage(stage) {
      stageLabel.textContent = stage;
      // Anything that is not one of the stages of a run — the words shown before one and after — leaves the sequence as it stands.
      const index = RUN_STAGES.indexOf(stage);
      if (index >= 0) {
        renderSequence(index + 1);
      }
    },

    setRunDisabled(disabled) {
      // Unavailable rather than disabled: the control keeps the keyboard focus of whoever has just pressed it.
      setUnavailable(runButton, disabled);
    },
    setContinueAvailable(available) {
      nextButton.hidden = !available;
    },
    showResult(result, isFirstRun) {
      // What was read, and what it cost. What the reading MEANS — which kind of machine this is —
      // is not said here: that is the reveal's to say.
      resultContainer.replaceChildren(
        createElement('p', { className: 'q-result__row' }, [
          createElement('span', { text: 'MEASUREMENT' }),
          createElement('span', { className: 'q-result__value', text: result.measuredLabel }),
        ]),
        createElement('p', { className: 'q-result__row' }, [
          createElement('span', { text: Q_COPY.queries }),
          createElement('span', { className: 'q-result__value', text: String(result.oracleQueries) }),
        ]),
      );
      renderSequence(stages.length, true);

      if (isFirstRun) {
        explanation.replaceChildren(
          createElement('p', { text: Q_COPY.exp1 }),
          createElement('p', { text: Q_COPY.exp2 }),
          createElement('p', { text: Q_COPY.name }),
        );
      }

      runButton.querySelector('.control__label')!.textContent = 'RUN AGAIN';
      nextButton.hidden = false;
    },
  };
}
