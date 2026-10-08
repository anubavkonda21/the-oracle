import { GAME_IDENTITY } from '../../config/identity';
import { createControlButton } from '../components/controlButton';
import { createStatusIndicator } from '../components/statusIndicator';
import { createElement, uniqueId } from '../dom';

export interface MainMenuViewOptions {
  onEnter: () => void;
}

/**
 * The title screen: the game's identity, and a single control to begin (layout: `.main-menu` in views.css).
 *
 * The machine stands in the middle of the room and nothing is printed over it. The name is set beneath
 * it, like the plate on an instrument, and the one control beneath that.
 */
export function createMainMenuView({ onEnter }: MainMenuViewOptions): HTMLElement {
  const titleId = uniqueId('main-menu-title');
  const { title, tagline, systemIdentifier } = GAME_IDENTITY;

  const heading = createElement('h1', { className: 'title', attributes: { id: titleId } }, [
    createElement('span', { className: 'title__article', text: title.article }),
    ' ',
    createElement('span', { className: 'title__name', text: title.name }),
  ]);

  const taglineLines = tagline.map((line) => createElement('span', { className: 'tagline__line', text: line }));

  return createElement('section', { className: 'view main-menu', attributes: { 'aria-labelledby': titleId } }, [
    createElement('header', { className: 'view__header' }, [
      createElement('p', { className: 'readout', text: systemIdentifier }),
      createStatusIndicator('SYSTEM ONLINE'),
    ]),
    createElement('div', { className: 'view__desk main-menu__desk' }, [
      createElement('div', { className: 'view__body main-menu__identity' }, [
        heading,
        createElement('p', { className: 'tagline' }, taglineLines),
      ]),
      createElement('div', { className: 'view__actions main-menu__action' }, [
        createControlButton({ label: 'ENTER', onActivate: onEnter, shortcut: { ariaKey: 'Enter' } }),
      ]),
    ]),
    createElement('p', { className: 'readout main-menu__state', text: 'SYSTEM: WAITING' }),
  ]);
}
