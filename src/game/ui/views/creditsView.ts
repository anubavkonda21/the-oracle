import { createElement } from '../dom';
import { createControlButton } from '../components/controlButton';
import { GAME_IDENTITY } from '../../config/identity';
import { Q_COPY } from '../../../qcopy';

export interface CreditsViewOptions {
  onNext: () => void;
}

export interface CreditsView {
  readonly element: HTMLElement;
}

/**
 * The credits (layout: `.credits` in views.css): the last page of the record, set out beneath the
 * machine as a sheet of entries under headings. Where it is longer than the space it is given, it
 * scrolls.
 */
export function createCreditsView({ onNext }: CreditsViewOptions): CreditsView {
  const identity = ['THE ORACLE', 'A QURIOSITY EXPERIMENT', Q_COPY.title];
  const sections = [
    { heading: 'CREATED BY', entries: ['ANUBAV K', 'SARADHI', 'CHANDAN', 'THRISHAL'] },
    { heading: 'BUILT WITH', entries: ['TypeScript', Q_COPY.p, 'Vite', 'Vitest'] },
    { heading: Q_COPY.system, entries: ['State-vector simulation', Q_COPY.oracle, Q_COPY.short] },
  ];
  const closing = ['QURIOSITY', '2026'];

  const [name = '', ...description] = identity;

  const sheet = createElement('div', { className: 'credits__sheet' }, [
    createElement('div', { className: 'credits__section credits__section--identity' }, [
      createElement('h1', { className: 'credits__name', text: name }),
      ...description.map((line) => createElement('p', { className: 'readout', text: line })),
    ]),
    ...sections.map(({ heading, entries }) =>
      createElement('div', { className: 'credits__section' }, [
        createElement('h2', { className: 'readout credits__heading', text: heading }),
        createElement('ul', { className: 'credits__entries', attributes: { role: 'list' } }, entries.map((entry) => createElement('li', { className: 'readout', text: entry }))),
      ]),
    ),
  ]);

  const nextButton = createControlButton({
    label: 'RETURN TO MENU',
    onActivate: onNext,
  });

  const element = createElement('section', { className: 'view credits' }, [
    createElement('header', { className: 'view__header' }, [
      createElement('p', { className: 'readout', text: GAME_IDENTITY.systemIdentifier }),
    ]),
    createElement('div', { className: 'view__desk credits__desk' }, [
      // The sheet can be scrolled with the keyboard as well as by touch.
      createElement('div', { className: 'view__body credits__record', attributes: { tabindex: '0', role: 'group', 'aria-label': 'Credits' } }, [
        sheet,
        createElement('div', { className: 'credits__close' }, [
          createElement('p', { className: 'readout', text: closing.join(' · ') }),
          createElement('p', { className: 'readout', text: 'END OF RECORD' }),
        ]),
      ]),
      createElement('div', { className: 'view__actions credits__actions' }, [nextButton]),
    ]),
  ]);

  return {
    element,
  };
}
