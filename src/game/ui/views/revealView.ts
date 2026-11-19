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
    createElement('p', { className: 'readout', text: 'THE ORACLE' }),
    createElement('p', { className: 'readout', text: '"You don\'t need to know what\'s inside."' }),
    createElement('p', { className: 'readout', text: '"You only need to know how to ask."' }),
    createElement('p', { className: 'readout', text: Q_COPY.title }),
    createElement('p', { className: 'readout', text: 'GAUNTLET CLEARED — ENDLESS MODE UNLOCKED' }),
  ];

  for (const line of lines) {
    line.style.opacity = '0';
    line.style.transition = 'opacity 1s';
  }

  const container = createElement('div', { className: 'reveal-container' }, lines);

  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
    shortcut: { ariaKey: 'Enter' },
  });
  nextButton.style.opacity = '0';
  nextButton.style.pointerEvents = 'none';
  nextButton.style.transition = 'opacity 1s';

  const element = createElement('section', { className: 'view reveal-view' }, [container, nextButton]);

  return {
    element,
    showLine(index) {
      if (index < lines.length) {
        if (lines[index]) {
          lines[index].style.opacity = '1';
        }
      } else {
        nextButton.style.opacity = '1';
        nextButton.style.pointerEvents = 'auto';
      }
    },
  };
}
