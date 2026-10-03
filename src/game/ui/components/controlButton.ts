import { createElement } from '../dom';

export interface ControlShortcut {
  /** The key in `aria-keyshortcuts` syntax, e.g. `Escape`. */
  ariaKey: string;
  /** Short key name shown beside the label, e.g. `ESC`. Omit when the label already names the key. */
  label?: string;
}

export interface ControlButtonOptions {
  label: string;
  onActivate: () => void;
  /** `primary` is the main action of a view; `quiet` is for secondary actions. */
  variant?: 'primary' | 'quiet';
  shortcut?: ControlShortcut;
  disabled?: boolean;
}

/**
 * The game's one button: a minimal scientific control (styles: `.control` in components.css).
 * It is a native <button>, so focus, Enter and Space all work without extra code.
 */
export function createControlButton(options: ControlButtonOptions): HTMLButtonElement {
  const { label, onActivate, variant = 'primary', shortcut, disabled = false } = options;

  const button = createElement('button', {
    className: `control control--${variant}`,
    attributes: { type: 'button' },
  });
  button.append(createElement('span', { className: 'control__label', text: label }));

  if (shortcut) {
    button.setAttribute('aria-keyshortcuts', shortcut.ariaKey);
  }
  if (shortcut?.label) {
    button.append(
      createElement('span', {
        className: 'control__shortcut',
        text: shortcut.label,
        attributes: { 'aria-hidden': 'true' },
      }),
    );
  }

  button.disabled = disabled;
  button.addEventListener('click', onActivate);
  return button;
}
