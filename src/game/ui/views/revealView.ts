import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import { GAME_IDENTITY } from '../../config/identity';
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

/**
 * The reveal (layout: `.reveal` in views.css): what the run read, and what follows from it, set out
 * beneath the machine as a finding is set out — the reading, then the conclusion drawn from it. The
 * scene shows it a line at a time (`showLine`), and the way on last of all.
 */
export function createRevealView({ result, onNext }: RevealViewOptions): RevealView {
  const verdictWord = result.measuredInput === 0 ? Q_COPY.c : Q_COPY.b;
  const isZero = result.measuredInput === 0;
  const resultDesc = isZero ? 'ZERO RESULT' : 'NON-ZERO RESULT';
  const { title } = GAME_IDENTITY;

  const lines = [
    createElement('p', { className: 'readout reveal__label', text: 'MEASUREMENT' }),
    createElement('p', { className: 'readout reveal__value', text: result.measuredLabel }),
    createElement('p', { className: 'readout reveal__reading', text: resultDesc }),
    createElement('p', { className: 'readout reveal__therefore', text: 'THEREFORE' }),
    createElement('p', { className: 'readout reveal__verdict', text: verdictWord }),
  ];

  const nextButton = createControlButton({
    label: 'CONTINUE',
    onActivate: onNext,
    shortcut: { ariaKey: 'Enter' },
  });

  // Each line, and then the control, stays out of sight until the scene shows it (styles: `.reveal__step`).
  const steps = [...lines, nextButton];
  for (const step of steps) {
    step.classList.add('reveal__step');
  }

  const element = createElement('section', { className: 'view reveal' }, [
    createElement('header', { className: 'view__header' }, [
      createElement('p', { className: 'wordmark', text: `${title.article} ${title.name}` }),
    ]),
    createElement('div', { className: 'view__desk reveal__desk' }, [
      createElement('div', { className: 'view__body reveal__finding' }, lines),
      createElement('div', { className: 'view__actions reveal__actions' }, [nextButton]),
    ]),
  ]);

  return {
    element,
    showLine(index) {
      // Past the last line, what is left to show is the control.
      steps[Math.min(index, steps.length - 1)]?.setAttribute('data-shown', '');
    },
  };
}
