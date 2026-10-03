import type { Bit } from '../../../quantum';
import { BOX_CENTER_Y, BOX_COPY } from '../../config/boxConfig';
import { DESIGN_HEIGHT } from '../../config/display';
import { GAME_IDENTITY } from '../../config/identity';
import type { BoxPhase } from '../../systems/box/BoxExperiment';
import { createControlButton, setUnavailable } from '../components/controlButton';
import { createStatusIndicator, setStatusLabel } from '../components/statusIndicator';
import { createElement, uniqueId } from '../dom';

export interface BoxViewOptions {
  onObserve: () => void;
  onObserveAgain: () => void;
  onReturn: () => void;
}

export interface BoxView {
  readonly element: HTMLElement;
  /** Shows the controls and status that belong to a phase of the experiment. */
  setPhase(phase: BoxPhase): void;
  /** Shows the result of the observation, followed by the short context. */
  showReport(outcome: Bit): void;
  /** Removes the report, ready for a newly sealed box. */
  clearReport(): void;
}

/**
 * The interface of THE BOX (layout: `.box-view` in box.css). Before the
 * observation it offers one action and explains nothing. The result and the
 * three sentences of context appear only afterwards.
 */
export function createBoxView({ onObserve, onObserveAgain, onReturn }: BoxViewOptions): BoxView {
  const titleId = uniqueId('box-title');
  const { title } = GAME_IDENTITY;

  const header = createElement('header', { className: 'box-view__header' }, [
    createElement('p', { className: 'wordmark', text: `${title.article} ${title.name}` }),
  ]);

  // Drawn in the top corner, but last in the document: Tab reaches OBSERVE first and this afterwards.
  const leaveButton = createControlButton({
    label: BOX_COPY.leave,
    variant: 'quiet',
    onActivate: onReturn,
    shortcut: { label: 'ESC', ariaKey: 'Escape' },
  });
  leaveButton.classList.add('box-view__leave');

  // The canvas is hidden from assistive technology, so the scene is described in words.
  const sceneDescription = createElement('p', {
    className: 'visually-hidden',
    text: 'A sealed, matte dark box stands alone in a dark room. Its front has a shuttered opening, which is closed.',
  });

  // Printed along the bottom of the box's front face: its name, and its state.
  const status = createStatusIndicator(BOX_COPY.status.sealed);
  status.setAttribute('role', 'status');
  const plate = createElement('div', { className: 'box-view__plate' }, [
    createElement('h1', { className: 'readout box-view__label', text: BOX_COPY.label, attributes: { id: titleId } }),
    status,
  ]);

  const sealedNote = createElement('p', { className: 'readout box-view__note', text: BOX_COPY.sealedNote });

  const resultValue = createElement('span', { className: 'box-view__result-value' });
  const report = createElement('div', { className: 'box-view__report', attributes: { 'aria-live': 'polite' } }, [
    createElement('p', { className: 'readout box-view__complete' }, [
      createElement('span', { text: BOX_COPY.complete }),
      resultValue,
    ]),
    ...BOX_COPY.context.map((sentence) => createElement('p', { className: 'box-view__context', text: sentence })),
  ]);
  report.hidden = true;

  const observeButton = createControlButton({
    label: BOX_COPY.observe,
    onActivate: onObserve,
    shortcut: { label: 'ENTER', ariaKey: 'Enter' },
  });
  const returnButton = createControlButton({
    label: BOX_COPY.returnToOracle,
    onActivate: onReturn,
    shortcut: { label: 'ENTER', ariaKey: 'Enter' },
  });
  const againButton = createControlButton({ label: BOX_COPY.observeAgain, variant: 'quiet', onActivate: onObserveAgain });

  const element = createElement('section', { className: 'view box-view', attributes: { 'aria-labelledby': titleId } }, [
    header,
    sceneDescription,
    plate,
    createElement('div', { className: 'box-view__below' }, [
      sealedNote,
      report,
      createElement('div', { className: 'box-view__actions' }, [observeButton, returnButton, againButton]),
    ]),
    leaveButton,
  ]);
  // Everything is placed relative to the box, wherever the scene puts the box.
  element.style.setProperty('--box-offset-y', String(BOX_CENTER_Y - DESIGN_HEIGHT / 2));

  return {
    element,

    setPhase(phase) {
      const observed = phase === 'observed';
      // If the control being replaced has the keyboard's focus, hand focus to the one that replaces it.
      const focusWasOnActions = [observeButton, returnButton, againButton].includes(document.activeElement as HTMLButtonElement);

      setStatusLabel(status, BOX_COPY.status[phase]);
      setUnavailable(observeButton, phase === 'observing');
      observeButton.hidden = observed;
      returnButton.hidden = !observed;
      againButton.hidden = !observed;
      sealedNote.hidden = observed;

      if (focusWasOnActions && phase !== 'observing') {
        (observed ? returnButton : observeButton).focus();
      }
    },

    showReport(outcome) {
      resultValue.textContent = `${BOX_COPY.result} ${outcome} · ${BOX_COPY.outcomes[outcome]}`;
      sceneDescription.textContent = `The box is open. Inside is the silhouette of a cat, ${
        outcome === 1 ? 'sitting upright and awake' : 'lying still'
      }.`;
      report.hidden = false;
    },

    clearReport() {
      report.hidden = true;
      resultValue.textContent = '';
      sceneDescription.textContent =
        'A sealed, matte dark box stands alone in a dark room. Its front has a shuttered opening, which is closed.';
    },
  };
}
