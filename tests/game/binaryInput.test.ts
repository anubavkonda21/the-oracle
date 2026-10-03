import { describe, expect, it } from 'vitest';
import {
  createBinaryInput,
  describeInputProblem,
  eraseBit,
  moveCursor,
  setCursor,
  toBinaryString,
  toggleBit,
  typeBit,
  type BinaryInputState,
} from '../../src/game/systems/oracle/binaryInput';
import type { Bit } from '../../src/quantum';

/** Types a string of digits, as the player would. */
function typeDigits(state: BinaryInputState, digits: string): BinaryInputState {
  return [...digits].reduce((current, digit) => typeBit(current, digit === '1' ? 1 : 0), state);
}

const from = (bits: string, cursor: number): BinaryInputState => ({
  bits: [...bits].map((digit): Bit => (digit === '1' ? 1 : 0)),
  cursor,
});

describe('createBinaryInput', () => {
  it('starts with every bit 0 and the cursor on the first', () => {
    const state = createBinaryInput(6);
    expect(toBinaryString(state)).toBe('000000');
    expect(state.cursor).toBe(0);
  });

  it.each([0, -1, 2.5])('rejects a length of %s', (length) => {
    expect(() => createBinaryInput(length)).toThrow(/Input length/);
  });
});

describe('typeBit', () => {
  it('sets the bit under the cursor and advances', () => {
    const state = typeBit(createBinaryInput(6), 1);
    expect(toBinaryString(state)).toBe('100000');
    expect(state.cursor).toBe(1);
  });

  it('fills the input from left to right', () => {
    const state = typeDigits(createBinaryInput(6), '010110');
    expect(toBinaryString(state)).toBe('010110');
    expect(state.cursor).toBe(6);
  });

  it('overwrites a bit that was already set', () => {
    expect(toBinaryString(typeBit(from('111', 1), 0))).toBe('101');
  });

  it('does nothing once every bit has been typed', () => {
    const full = typeDigits(createBinaryInput(3), '101');
    expect(typeBit(full, 1)).toBe(full);
    expect(toBinaryString(typeDigits(full, '111'))).toBe('101');
  });

  it('types from wherever the cursor has been put', () => {
    const state = typeDigits(setCursor(createBinaryInput(6), 3), '11');
    expect(toBinaryString(state)).toBe('000110');
    expect(state.cursor).toBe(5);
  });
});

describe('eraseBit', () => {
  it('steps back and resets that bit to 0', () => {
    const state = eraseBit(typeDigits(createBinaryInput(4), '11'));
    expect(toBinaryString(state)).toBe('1000');
    expect(state.cursor).toBe(1);
  });

  it('undoes the last digit after the input is full', () => {
    const state = eraseBit(typeDigits(createBinaryInput(3), '111'));
    expect(toBinaryString(state)).toBe('110');
    expect(state.cursor).toBe(2);
  });

  it('does nothing at the start', () => {
    const start = createBinaryInput(3);
    expect(eraseBit(start)).toBe(start);
  });

  it('undoes typing exactly, digit by digit', () => {
    let state = typeDigits(createBinaryInput(6), '111111');
    for (let step = 0; step < 6; step += 1) {
      state = eraseBit(state);
    }
    expect(toBinaryString(state)).toBe('000000');
    expect(state.cursor).toBe(0);
  });
});

describe('toggleBit', () => {
  it('flips one bit and leaves the rest alone', () => {
    expect(toBinaryString(toggleBit(from('010110', 0), 3))).toBe('010010');
    expect(toBinaryString(toggleBit(from('010110', 0), 0))).toBe('110110');
  });

  it('returns to the original when applied twice', () => {
    const original = from('010110', 2);
    expect(toBinaryString(toggleBit(toggleBit(original, 4), 4))).toBe('010110');
  });

  it('moves the cursor to the bit that was flipped', () => {
    expect(toggleBit(from('000000', 0), 4).cursor).toBe(4);
  });

  it.each([-1, 6, 1.5])('ignores index %s, which is not a bit', (index) => {
    const state = from('010110', 2);
    expect(toggleBit(state, index)).toBe(state);
  });
});

describe('cursor movement', () => {
  it('moves left and right', () => {
    expect(moveCursor(from('000000', 2), 1).cursor).toBe(3);
    expect(moveCursor(from('000000', 2), -1).cursor).toBe(1);
  });

  it('stops at the first and last bit', () => {
    const atStart = from('000000', 0);
    const atEnd = from('000000', 5);
    expect(moveCursor(atStart, -1)).toBe(atStart);
    expect(moveCursor(atEnd, 1)).toBe(atEnd);
  });

  it('steps back onto the last bit from past the end', () => {
    const full = typeDigits(createBinaryInput(6), '111111');
    expect(moveCursor(full, -1).cursor).toBe(5);
    expect(moveCursor(full, 1).cursor).toBe(5);
  });

  it('never changes a value', () => {
    const state = from('010110', 1);
    expect(toBinaryString(moveCursor(state, 3))).toBe('010110');
    expect(toBinaryString(setCursor(state, 4))).toBe('010110');
  });

  it('can be placed on any bit, and nowhere else', () => {
    const state = from('010110', 1);
    expect(setCursor(state, 5).cursor).toBe(5);
    expect(setCursor(state, 6)).toBe(state);
    expect(setCursor(state, -1)).toBe(state);
  });

  it('returns the very same state when nothing changes', () => {
    const state = from('010110', 3);
    expect(setCursor(state, 3)).toBe(state);
  });
});

describe('immutability', () => {
  it('never alters the state it was given', () => {
    const original = from('010110', 2);
    const snapshot = JSON.stringify(original);

    typeBit(original, 1);
    eraseBit(original);
    toggleBit(original, 0);
    moveCursor(original, 1);
    setCursor(original, 5);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('describeInputProblem', () => {
  it('accepts a binary string of the right length', () => {
    expect(describeInputProblem('010110', 6)).toBeNull();
    expect(describeInputProblem('0', 1)).toBeNull();
  });

  it('explains a wrong length', () => {
    expect(describeInputProblem('0101', 6)).toMatch(/exactly 6 bits; received 4/);
    expect(describeInputProblem('0101101', 6)).toMatch(/exactly 6 bits; received 7/);
    expect(describeInputProblem('', 6)).toMatch(/exactly 6 bits; received 0/);
  });

  it('explains characters that are not binary digits', () => {
    expect(describeInputProblem('01011x', 6)).toMatch(/only the digits 0 and 1/);
    expect(describeInputProblem('012345', 6)).toMatch(/only the digits 0 and 1/);
  });

  it('agrees with what the input model produces', () => {
    const state = typeDigits(createBinaryInput(6), '110011');
    expect(describeInputProblem(toBinaryString(state), 6)).toBeNull();
  });
});
