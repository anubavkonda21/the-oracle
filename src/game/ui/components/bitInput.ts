import type { BinaryInputState } from '../../systems/oracle/binaryInput';
import { createElement } from '../dom';
import { isUnavailable, setUnavailable } from './controlButton';

export interface BitInputOptions {
  length: number;
  /** Id of the element that names this group, e.g. the "INPUT" label. */
  labelledBy: string;
  onToggle: (index: number) => void;
  /** A bit received keyboard focus, so the typing cursor should move to it. */
  onFocusBit: (index: number) => void;
  onSubmit: () => void;
}

export interface BitInput {
  readonly element: HTMLElement;
  /** Draws the given state: each bit's value, and which bit holds the cursor. */
  render(state: BinaryInputState): void;
  setUnavailable(unavailable: boolean): void;
  /** True when keyboard focus is on one of the bits. */
  hasFocus(): boolean;
  focusBit(index: number): void;
}

/**
 * A row of bits the player sets by hand (styles: `.bit-input` in oracle.css).
 * Each bit is a real button: a click or Space flips it. It holds no state of
 * its own — it reports what the player did and draws the state it is given.
 */
export function createBitInput(options: BitInputOptions): BitInput {
  const { length, labelledBy, onToggle, onFocusBit, onSubmit } = options;

  const bits = Array.from({ length }, (_, index) => {
    const bit = createElement('button', { className: 'bit', attributes: { type: 'button' } });

    bit.addEventListener('click', () => {
      if (!isUnavailable(bit)) {
        onToggle(index);
      }
    });
    bit.addEventListener('focus', () => onFocusBit(index));
    bit.addEventListener('keydown', (event) => {
      // On a bit, Enter asks the machine rather than flipping the bit (Space does that).
      // Preventing the default also stops the scene's own Enter shortcut from firing twice.
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit();
      }
    });
    return bit;
  });

  const element = createElement(
    'div',
    { className: 'bit-input', attributes: { role: 'group', 'aria-labelledby': labelledBy } },
    bits,
  );

  return {
    element,

    render(state) {
      bits.forEach((bit, index) => {
        const value = state.bits[index] ?? 0;
        bit.textContent = String(value);
        bit.dataset.value = String(value);
        bit.setAttribute('aria-label', `Bit ${index + 1} of ${length}: ${value}`);
        bit.toggleAttribute('data-cursor', state.cursor === index);
      });
    },

    setUnavailable(unavailable) {
      for (const bit of bits) {
        setUnavailable(bit, unavailable);
      }
    },

    hasFocus() {
      return element.contains(document.activeElement);
    },

    focusBit(index) {
      bits[index]?.focus();
    },
  };
}
