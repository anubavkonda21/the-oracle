import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import { Q_COPY } from '../../../qcopy';

export interface RevealViewOptions {
  onNext: () => void;
}

export interface RevealView {
  readonly element: HTMLElement;
  showLine(index: number): void;
}

export function createRevealView({ onNext }: RevealViewOptions): RevealView {
  const lines = [
    createElement('p', { className: 'readout', text: 'YOU DIDN\'T CHECK EVERY POSSIBILITY.' }),
    createElement('p', { className: 'readout', text: 'YOU CHANGED THE WAY YOU ASKED THE QUESTION.' }),
    createElement('p', { className: 'readout', text: Q_COPY.title }),
    createElement('p', { className: 'readout', text: `${Q_COPY.c} → 000000` }),
    createElement('p', { className: 'readout', text: `${Q_COPY.b} → NON-ZERO MEASUREMENT` }),
    createElement('p', { className: 'readout', text: `${Q_COPY.queries} → 1` }),
  ];

  for (const line of lines) {
    line.style.opacity = '0';
    line.style.transition = 'opacity 1s';
  }

  const container = createElement('div', { className: 'reveal-container' }, lines);
  
  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
  });
  nextButton.style.opacity = '0';
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
      }
    }
  };
}
