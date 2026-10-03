import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import type { DeutschJozsaResult } from '../../../quantum/deutschJozsa';
import { Q_COPY } from '../../../qcopy';

export interface QuantumViewOptions {
  onRun: () => void;
  onNext: () => void;
}

export interface QuantumView {
  readonly element: HTMLElement;
  showResult(result: DeutschJozsaResult, isFirstRun: boolean): void;
  setStage(stage: string): void;
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

  const element = createElement('section', { className: 'view q-view' }, [
    createElement('div', { className: 'q-header' }, [
      createElement('h1', { className: 'wordmark', text: Q_COPY.mode })
    ]),
    stageLabel,
    resultContainer,
    explanation,
    createElement('div', { className: 'q-actions' }, [
      runButton, nextButton
    ])
  ]);

  return {
    element,
    setStage(stage) {
      stageLabel.textContent = stage;
    },
    showResult(result, isFirstRun) {
      resultContainer.innerHTML = '';
      resultContainer.appendChild(createElement('p', { text: `MEASUREMENT: ${result.measuredLabel}` }));
      resultContainer.appendChild(createElement('p', { text: `ORACLE CLASSIFICATION: ${result.verdict.toUpperCase()}` }));
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
