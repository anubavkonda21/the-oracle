import { createElement, uniqueId } from '../dom';

export interface PanelOptions {
  /** Short machine-style heading, e.g. `OBJECTIVE`. */
  heading: string;
  content: readonly (Node | string)[];
}

/** A titled, bordered surface for grouping HUD information (styles: `.panel` in components.css). */
export function createPanel({ heading, content }: PanelOptions): HTMLElement {
  const headingId = uniqueId('panel-heading');

  return createElement('section', { className: 'panel', attributes: { 'aria-labelledby': headingId } }, [
    createElement('h2', { className: 'panel__heading', text: heading, attributes: { id: headingId } }),
    createElement('div', { className: 'panel__content' }, content),
  ]);
}
