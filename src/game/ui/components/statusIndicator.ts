import { createElement } from '../dom';

/**
 * A signal dot followed by a machine-readout label, e.g. "● SYSTEM ONLINE"
 * (styles: `.status` in components.css). The state is always spelled out in
 * the label; the dot's colour is never the only thing carrying it.
 */
export function createStatusIndicator(label: string): HTMLParagraphElement {
  return createElement('p', { className: 'status' }, [
    createElement('span', { className: 'status__dot', attributes: { 'aria-hidden': 'true' } }),
    createElement('span', { className: 'status__label', text: label }),
  ]);
}

/** Changes the label of an existing indicator, e.g. from "ONLINE" to "PROCESSING". */
export function setStatusLabel(indicator: HTMLElement, label: string): void {
  const labelElement = indicator.querySelector('.status__label');
  if (labelElement) {
    labelElement.textContent = label;
  }
}
