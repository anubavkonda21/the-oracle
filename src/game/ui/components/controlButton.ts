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
  button.addEventListener('click', () => {
    if (!isUnavailable(button)) {
      onActivate();
    }
  });
  return button;
}

/**
 * Makes a control temporarily unusable WITHOUT removing it from the keyboard
 * focus order. A truly `disabled` button drops focus the moment it is
 * disabled, which would throw a keyboard user out of the control they just
 * pressed; `aria-disabled` keeps them where they are.
 */
export function setUnavailable(control: HTMLElement, unavailable: boolean): void {
  if (unavailable) {
    control.setAttribute('aria-disabled', 'true');
  } else {
    control.removeAttribute('aria-disabled');
  }
}

export function isUnavailable(control: HTMLElement): boolean {
  return control.getAttribute('aria-disabled') === 'true';
}

/**
 * Makes a control one that stays down: a choice that is either made or not.
 * It is drawn filled while pressed (styles: `.control[aria-pressed]`), and
 * `aria-pressed` tells assistive technology the same thing.
 */
export function setPressed(control: HTMLElement, pressed: boolean): void {
  control.setAttribute('aria-pressed', String(pressed));
}
