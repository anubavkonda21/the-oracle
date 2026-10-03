import type { Bit } from '../../../quantum';

/**
 * The binary input the player is composing, as plain data. Every change
 * returns a new state, so this can be tested without a browser and the
 * interface simply draws whatever state it is given.
 */
export interface BinaryInputState {
  readonly bits: readonly Bit[];
  /**
   * Index of the bit the next typed digit will set. It equals `bits.length`
   * once the last bit has been typed, meaning there is nothing left to fill.
   */
  readonly cursor: number;
}

const BINARY_STRING = /^[01]+$/;

/** Why a string cannot be given to the machine, or `null` if it can. */
export function describeInputProblem(input: string, length: number): string | null {
  if (input.length !== length) {
    return `Expected exactly ${length} bits; received ${input.length}.`;
  }
  if (!BINARY_STRING.test(input)) {
    return 'An input may contain only the digits 0 and 1.';
  }
  return null;
}

/** All bits 0, with the cursor on the first. */
export function createBinaryInput(length: number): BinaryInputState {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError(`Input length must be a positive whole number; received ${length}.`);
  }
  return { bits: new Array<Bit>(length).fill(0), cursor: 0 };
}

function withBit(state: BinaryInputState, index: number, bit: Bit): Bit[] {
  return state.bits.map((existing, position) => (position === index ? bit : existing));
}

function isBitIndex(state: BinaryInputState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.bits.length;
}

/** Flips one bit, as a click on it does, and moves the cursor there. */
export function toggleBit(state: BinaryInputState, index: number): BinaryInputState {
  if (!isBitIndex(state, index)) {
    return state;
  }
  return { bits: withBit(state, index, state.bits[index] === 1 ? 0 : 1), cursor: index };
}

/** Sets the bit under the cursor, as typing a digit does, and advances. Does nothing once every bit has been typed. */
export function typeBit(state: BinaryInputState, bit: Bit): BinaryInputState {
  if (!isBitIndex(state, state.cursor)) {
    return state;
  }
  return { bits: withBit(state, state.cursor, bit), cursor: state.cursor + 1 };
}

/** Steps back one bit and resets it to 0, as Backspace does. */
export function eraseBit(state: BinaryInputState): BinaryInputState {
  if (state.cursor === 0) {
    return state;
  }
  const cursor = state.cursor - 1;
  return { bits: withBit(state, cursor, 0), cursor };
}

/** Puts the cursor on a particular bit without changing any value. */
export function setCursor(state: BinaryInputState, index: number): BinaryInputState {
  return isBitIndex(state, index) && index !== state.cursor ? { bits: state.bits, cursor: index } : state;
}

/** Moves the cursor left or right, as the arrow keys do, staying on a bit. */
export function moveCursor(state: BinaryInputState, offset: number): BinaryInputState {
  const lastIndex = state.bits.length - 1;
  const cursor = Math.min(lastIndex, Math.max(0, state.cursor + offset));
  return cursor === state.cursor ? state : { bits: state.bits, cursor };
}

/** The input as the string the machine receives, leftmost bit first — e.g. "010110". */
export function toBinaryString(state: BinaryInputState): string {
  return state.bits.join('');
}
