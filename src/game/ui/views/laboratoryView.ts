import { GAME_IDENTITY, LEVEL_COUNT } from '../../config/identity';
import { formatCounter } from '../../../utils/format';
import { createControlButton } from '../components/controlButton';
import { createPanel } from '../components/panel';
import { createStatusIndicator } from '../components/statusIndicator';
import { createElement, uniqueId } from '../dom';

export interface LaboratoryViewOptions {
  /** 1-based level number shown in the progression indicator. */
  levelNumber: number;
  objective: string;
  onReturn: () => void;
}

/**
 * HUD shell for the laboratory (layout: `.laboratory` in views.css).
 * The centre of the view is left empty: that is where the canvas shows the machine.
 */
export function createLaboratoryView({ levelNumber, objective, onReturn }: LaboratoryViewOptions): HTMLElement {
  const titleId = uniqueId('laboratory-title');
  const { title } = GAME_IDENTITY;

  const header = createElement('header', { className: 'laboratory__header' }, [
    createElement('h1', {
      className: 'wordmark',
      text: `${title.article} ${title.name}`,
      attributes: { id: titleId },
    }),
    createElement('p', {
      className: 'readout',
      text: formatCounter(levelNumber, LEVEL_COUNT),
      attributes: { 'aria-label': `Level ${levelNumber} of ${LEVEL_COUNT}` },
    }),
  ]);

  // The canvas is hidden from assistive technology, so the scene is described in words.
  const sceneDescription = createElement('p', {
    className: 'visually-hidden',
    text: 'A matte black machine with a single circular aperture stands in the centre of the laboratory. A small red status light is lit.',
  });

  const footer = createElement('footer', { className: 'laboratory__footer' }, [
    createPanel({
      heading: 'OBJECTIVE',
      content: [createElement('p', { className: 'panel__text', text: objective })],
    }),
    createControlButton({
      label: 'RETURN',
      variant: 'quiet',
      onActivate: onReturn,
      shortcut: { label: 'ESC', ariaKey: 'Escape' },
    }),
    createPanel({
      heading: 'SYSTEM STATUS',
      content: [createStatusIndicator('ONLINE')],
    }),
  ]);

  return createElement('section', { className: 'view laboratory', attributes: { 'aria-labelledby': titleId } }, [
    header,
    sceneDescription,
    footer,
  ]);
}
