import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import { Q_COPY } from '../../../qcopy';
import type { DeutschJozsaResult } from '../../../quantum/deutschJozsa';

export interface RevealViewOptions {
  result: DeutschJozsaResult;
  onNext: () => void;
}

export interface RevealView {
  readonly element: HTMLElement;
  showLine(index: number): void;
}

export function createRevealView({ result, onNext }: RevealViewOptions): RevealView {
  const verdictWord = result.measuredInput === 0 ? Q_COPY.c : Q_COPY.b;
  const isZero = result.measuredInput === 0;
  const resultDesc = isZero ? 'ZERO RESULT' : 'NON-ZERO RESULT';

  const lines = [
    createElement('p', { className: 'readout', text: 'MEASUREMENT' }),
    createElement('p', { className: 'readout', text: result.measuredLabel }),
    createElement('p', { className: 'readout', text: resultDesc }),
    createElement('p', { className: 'readout', text: 'THEREFORE' }),
    createElement('p', { className: 'readout', text: verdictWord }),
  ];

  for (const line of lines) {
    line.style.opacity = '0';
    line.style.transition = 'opacity 1s';
  }

  const container = createElement('div', { className: 'reveal-container' }, lines);
  
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
    shortcut: { ariaKey: 'Enter' }
  });
  nextButton.style.opacity = '0';
  nextButton.style.pointerEvents = 'none';
  nextButton.style.transition = 'opacity 1s';

  const element = createElement('section', { className: 'view reveal-view' }, [
    container,
    nextButton
  ]);

  return {
    element,
    showLine(index) {
      if (index < lines.length) {
        if (lines[index]) { lines[index].style.opacity = '1'; }
      } else {
        nextButton.style.opacity = '1';
        nextButton.style.pointerEvents = 'auto';
      }
    }
  };
}
