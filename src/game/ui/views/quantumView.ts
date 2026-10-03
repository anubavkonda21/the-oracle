import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import type { DeutschJozsaResult } from '../../../quantum/deutschJozsa';

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
  const resultContainer = createElement('div', { className: 'quantum-result' });
  const stageLabel = createElement('h2', { className: 'quantum-stage', text: 'READY' });
  const explanation = createElement('div', { className: 'quantum-explanation' });

  const runButton = createControlButton({
    label: 'RUN DEUTSCH-JOZSA',
    onActivate: onRun,
  });
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
  });
  nextButton.hidden = true;

  const element = createElement('section', { className: 'view quantum-view' }, [
    createElement('div', { className: 'quantum-header' }, [
      createElement('h1', { className: 'wordmark', text: 'QUANTUM MODE' })
    ]),
    stageLabel,
    resultContainer,
    explanation,
    createElement('div', { className: 'quantum-actions' }, [
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
      resultContainer.appendChild(createElement('p', { text: `QUANTUM ORACLE QUERIES: ${result.oracleQueries}` }));

      if (isFirstRun) {
        explanation.innerHTML = '';
        explanation.appendChild(createElement('p', { text: 'You did not determine the rule by checking every input.' }));
        explanation.appendChild(createElement('p', { text: 'The experiment used interference to distinguish the two promised cases.' }));
        explanation.appendChild(createElement('p', { text: 'Deutsch–Jozsa algorithm.' }));
      }
      
      runButton.querySelector('.control__label')!.textContent = 'RUN AGAIN';
      nextButton.hidden = false;
    }
  };
}
