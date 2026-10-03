import { GAME_IDENTITY } from '../../config/identity';
import { createControlButton } from '../components/controlButton';
import { createStatusIndicator } from '../components/statusIndicator';
import { createElement, uniqueId } from '../dom';

export interface MainMenuViewOptions {
  onEnter: () => void;
}

/** The title screen: the game's identity, and a single control to begin (layout: `.main-menu` in views.css). */
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
    createElement('p', { className: 'readout main-menu__identifier', text: systemIdentifier }),
    createElement('div', { className: 'main-menu__status' }, [createStatusIndicator('SYSTEM ONLINE')]),
    createElement('div', { className: 'main-menu__identity' }, [
      heading,
      createElement('p', { className: 'tagline' }, taglineLines),
    ]),
    createElement('div', { className: 'main-menu__action' }, [
      createControlButton({ label: 'ENTER', onActivate: onEnter, shortcut: { ariaKey: 'Enter' } }),
    ]),
    createElement('p', { className: 'readout main-menu__state', text: 'SYSTEM: WAITING' }),
  ]);
}
