import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import type { DeutschJozsaResult } from '../../../quantum/deutschJozsa';
import { Q_COPY } from '../../../qcopy';
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

export function createQuantumView({ onRun, onNext }: QuantumViewOptions): QuantumView {
  const resultContainer = createElement('div', { className: 'q-result' });
  const stageLabel = createElement('h2', { className: 'q-stage', text: 'READY' });
  const explanation = createElement('div', { className: 'q-explanation' });

  const runButton = createControlButton({
    label: Q_COPY.run,
    onActivate: onRun,
  });
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
  });
  nextButton.hidden = true;


  // The run itself is seen on the machine, which stands in the middle of the stage. The name of the
  // stage is above it; what the run read, and what to make of it, below.
  const element = createElement('section', { className: 'view q-view' }, [
    createElement('div', { className: 'q-header' }, [
      createElement('h1', { className: 'wordmark', text: Q_COPY.mode })
    ]),
    stageLabel,
    createElement('div', { className: 'q-readout' }, [resultContainer, explanation]),
    createElement('div', { className: 'q-actions' }, [
      runButton, nextButton
    ])
  ]);
  element.style.setProperty('--machine-offset-y', String(MACHINE_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,
    setStage(stage) {
      stageLabel.textContent = stage;
    },

    setRunDisabled(disabled) {
      if (disabled) {
        runButton.setAttribute('disabled', 'true');
        runButton.style.opacity = '0.5';
        runButton.style.pointerEvents = 'none';
      } else {
        runButton.removeAttribute('disabled');
        runButton.style.opacity = '1';
        runButton.style.pointerEvents = 'auto';
      }
    },
    setContinueAvailable(available) {
      nextButton.hidden = !available;
    },
    showResult(result, isFirstRun) {
      // What was read, and what it cost. What the reading MEANS — which kind of machine this is —
      // is not said here: that is the reveal's to say.
      resultContainer.innerHTML = '';
      resultContainer.appendChild(createElement('p', { text: `MEASUREMENT: ${result.measuredLabel}` }));
      resultContainer.appendChild(createElement('p', { text: `${Q_COPY.queries}: ${result.oracleQueries}` }));

      if (isFirstRun) {
        explanation.innerHTML = '';
        explanation.appendChild(createElement('p', { text: Q_COPY.exp1 }));
        explanation.appendChild(createElement('p', { text: Q_COPY.exp2 }));
        explanation.appendChild(createElement('p', { text: Q_COPY.name }));
      }
      
      runButton.querySelector('.control__label')!.textContent = 'RUN AGAIN';
      nextButton.hidden = false;
    }
  };
}
