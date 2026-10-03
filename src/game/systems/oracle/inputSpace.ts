import { describeInputProblem } from './binaryInput';

/**
 * The input space: every input an n-bit machine can be given. There are 2^n
 * of them, and each has a position — its value read as a binary number, with
 * the leftmost bit the most significant, as everywhere else in the game.
 */

/** How many different inputs there are for an input of this many bits: 2^n. */
export function inputSpaceSize(inputLength: number): number {
  if (!Number.isInteger(inputLength) || inputLength < 1) {
    throw new RangeError(`Input length must be a positive whole number; received ${inputLength}.`);
  }
  return 2 ** inputLength;
}

/** A grid with one cell for every possible input. */
export interface InputSpaceLayout {
  readonly columns: number;
  readonly rows: number;
}

/**
 * The shape of that grid: as near to square as the bit count allows, and
 * never taller than it is wide. Read left to right and top to bottom, the
 * cells are the inputs in counting order, so the first bits of an input pick
 * its row and the rest pick its column.
 */
export function inputSpaceLayout(inputLength: number): InputSpaceLayout {
  const size = inputSpaceSize(inputLength);
  const columns = 2 ** Math.ceil(inputLength / 2);
  return { columns, rows: size / columns };
}

/** The position of an input in the space — "000000" is 0, "000001" is 1, "100000" is 32. */
export function inputIndex(input: string): number {
  const problem = describeInputProblem(input, input.length);
  if (problem) {
    throw new RangeError(`"${input}" has no position in the input space. ${problem}`);
  }
  return Number.parseInt(input, 2);
}

/** The input at a position: the reverse of `inputIndex`. */
export function inputAt(index: number, inputLength: number): string {
  const size = inputSpaceSize(inputLength);
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    throw new RangeError(`Position ${index} is outside an input space of ${size}: expected 0 to ${size - 1}.`);
  }
  return index.toString(2).padStart(inputLength, '0');
}
