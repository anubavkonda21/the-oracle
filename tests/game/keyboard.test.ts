import { describe, expect, it } from 'vitest';
import { isGameKeyPress, type KeyPressLike } from '../../src/game/systems/keyboard';

const plain: KeyPressLike = { defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false };

describe('isGameKeyPress', () => {
  it('accepts a plain key press', () => {
    expect(isGameKeyPress(plain)).toBe(true);
  });

  it('leaves alone a press that something else has already handled', () => {
    // A bit that has focus handles Enter itself; the scene must not act on the same press again.
    expect(isGameKeyPress({ ...plain, defaultPrevented: true })).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('leaves browser shortcuts alone: %s held', (modifier) => {
    // Cmd+1 switches tab and Ctrl+0 resets zoom; neither should type a bit.
    expect(isGameKeyPress({ ...plain, [modifier]: true })).toBe(false);
  });
});
