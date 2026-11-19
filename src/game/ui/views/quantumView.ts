import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import type { DeutschJozsaResult, DeutschJozsaStep } from '../../../quantum/deutschJozsa';
import { Q_COPY } from '../../../qcopy';

export interface QuantumViewOptions {
  onRun: () => void;
  onNext: () => void;
}

export interface QuantumView {
  readonly element: HTMLElement;
  showResult(result: DeutschJozsaResult): void;
  setStage(stage: string): void;
  renderState(step: DeutschJozsaStep): void;
  setRunDisabled(disabled: boolean): void;
}

export function createQuantumView({ onRun, onNext }: QuantumViewOptions): QuantumView {
  const resultContainer = createElement('div', { className: 'q-result' });
  const stageLabel = createElement('h2', { className: 'q-stage', text: 'READY' });
  const detectorContainer = createElement('div', { className: 'q-detector-box' });

  const runButton = createControlButton({
    label: Q_COPY.run,
    onActivate: onRun,
  });
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
  });
  nextButton.hidden = true;

  const stateContainer = createElement('div', { className: 'q-state' });
  const qubits = Array.from({ length: 6 }, () =>
    createElement('div', { className: 'q-node', text: '·' }),
  );
  qubits.forEach((q) => stateContainer.appendChild(q));

  const element = createElement('section', { className: 'view q-view' }, [
    createElement('div', { className: 'q-header' }, [
      createElement('h1', { className: 'wordmark', text: Q_COPY.mode }),
    ]),
    stageLabel,
    stateContainer,
    detectorContainer,
    resultContainer,
    createElement('div', { className: 'q-actions' }, [runButton, nextButton]),
  ]);

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

    renderState(step) {
      const id = step.id;
      if (id === 'prepared') {
        qubits.forEach((q) => (q.textContent = '0'));
      } else if (id === 'superposed' || id === 'interfered') {
        // Purely visual node indicator (no text lecture or psi)
        qubits.forEach((q) => (q.textContent = '∿'));
      } else if (id === 'queried') {
        qubits.forEach((q) => (q.textContent = '±'));
      }
    },

    showResult(result) {
      resultContainer.innerHTML = '';
      const bits = result.measuredLabel.split('');
      qubits.forEach((q, i) => (q.textContent = bits[i] ?? '0'));

      const isZero = result.measuredInput === 0;
      const statusText = isZero
        ? '000000 DETECTOR: LIT'
        : `000000 DETECTOR: CANCELLED (SCATTER: ${result.measuredLabel})`;

      detectorContainer.textContent = statusText;

      runButton.querySelector('.control__label')!.textContent = 'RUN AGAIN';
      nextButton.hidden = false;
    },
  };
}
