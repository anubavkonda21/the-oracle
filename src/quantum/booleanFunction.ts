import type { RandomSource } from './measurement';
import { MAX_QUBIT_COUNT } from './state';

/** A single classical bit. */
export type Bit = 0 | 1;

/**
 * A Boolean function of n bits: f(x) → 0 or 1.
 *
 * The input x is an n-bit integer. Its binary label follows the engine's
 * qubit order (see state.ts): the leftmost bit of x belongs to qubit 0. So x
 * is simply the basis index of the input register.
 */
export interface BooleanFunction {
  readonly inputQubitCount: number;
  evaluate(input: number): Bit;
}

/**
 * How a function's outputs are distributed over all 2^n inputs.
 *
 *   constant — the same output for every input
 *   balanced — 0 for exactly half the inputs and 1 for the other half
 *   neither  — anything else; such a function breaks the Deutsch–Jozsa promise
 */
export type BooleanFunctionKind = 'constant' | 'balanced' | 'neither';

/** The oracle needs one ancilla qubit beside the input register, so one qubit of the engine's capacity is reserved. */
export const MAX_INPUT_QUBIT_COUNT = MAX_QUBIT_COUNT - 1;

function assertInputQubitCount(inputQubitCount: number): void {
  if (!Number.isInteger(inputQubitCount) || inputQubitCount < 1 || inputQubitCount > MAX_INPUT_QUBIT_COUNT) {
    throw new RangeError(
      `Input qubit count must be a whole number from 1 to ${MAX_INPUT_QUBIT_COUNT}; received ${inputQubitCount}.`,
    );
  }
}

function isBit(value: unknown): value is Bit {
  return value === 0 || value === 1;
}

/** x·mask (mod 2): 1 when the two numbers share an odd number of set bits. */
function bitwiseDotProduct(x: number, mask: number): Bit {
  let shared = x & mask;
  let parity = 0;
  while (shared !== 0) {
    parity ^= shared & 1;
    shared >>>= 1;
  }
  return parity === 0 ? 0 : 1;
}

/**
 * Wraps a rule as a BooleanFunction. Every other factory goes through here,
 * so every function rejects out-of-range inputs and can only ever return a bit.
 */
export function createBooleanFunction(inputQubitCount: number, rule: (input: number) => Bit): BooleanFunction {
  assertInputQubitCount(inputQubitCount);
  const inputCount = 2 ** inputQubitCount;

  return Object.freeze({
    inputQubitCount,
    evaluate(input: number): Bit {
      if (!Number.isInteger(input) || input < 0 || input >= inputCount) {
        throw new RangeError(
          `Input ${input} is out of range for a function of ${inputQubitCount} bit(s): expected 0 to ${inputCount - 1}.`,
        );
      }
      const output: unknown = rule(input);
      if (!isBit(output)) {
        throw new TypeError(`A Boolean function must return 0 or 1; received ${String(output)} for input ${input}.`);
      }
      return output;
    },
  });
}

/** CONSTANT: f(x) = value for every x. */
export function createConstantFunction(inputQubitCount: number, value: Bit): BooleanFunction {
  if (!isBit(value)) {
    throw new TypeError(`A constant function's value must be 0 or 1; received ${String(value)}.`);
  }
  return createBooleanFunction(inputQubitCount, () => value);
}

/**
 * BALANCED: f(x) = x·mask (mod 2), the parity of the bits of x selected by
 * `mask`, optionally inverted. Any non-zero mask gives a balanced function:
 * flipping one selected bit of x always flips the output, which pairs every
 * input giving 0 with one giving 1.
 */
export function createParityFunction(inputQubitCount: number, mask: number, invert = false): BooleanFunction {
  assertInputQubitCount(inputQubitCount);
  const largestMask = 2 ** inputQubitCount - 1;
  if (!Number.isInteger(mask) || mask < 1 || mask > largestMask) {
    throw new RangeError(
      `A parity mask for ${inputQubitCount} bit(s) must be a whole number from 1 to ${largestMask}; received ${mask}. (A mask of 0 would select no bits and give a constant function.)`,
    );
  }
  const inversion = invert ? 1 : 0;
  return createBooleanFunction(inputQubitCount, (input) => (bitwiseDotProduct(input, mask) === inversion ? 0 : 1));
}

/**
 * Any function at all, given as its outputs in input order: `outputs[x]` is
 * f(x). The bit count is inferred from the length, which must be 2^n. The
 * result may be constant, balanced or neither.
 */
export function createFunctionFromTruthTable(outputs: readonly Bit[]): BooleanFunction {
  const inputCount = outputs.length;
  const isPowerOfTwo = inputCount >= 2 && (inputCount & (inputCount - 1)) === 0;
  if (!isPowerOfTwo) {
    throw new RangeError(
      `A truth table needs exactly 2^n outputs for n ≥ 1 bits (2, 4, 8, …); received ${inputCount}.`,
    );
  }
  const table = outputs.map((output, input) => {
    if (!isBit(output)) {
      throw new TypeError(`Truth-table entry ${input} must be 0 or 1; received ${String(output)}.`);
    }
    return output;
  });

  return createBooleanFunction(31 - Math.clz32(inputCount), (input) => {
    const output = table[input];
    if (output === undefined) {
      throw new RangeError(`No truth-table entry for input ${input}.`);
    }
    return output;
  });
}

/**
 * BALANCED: a function chosen uniformly at random from ALL balanced functions
 * of n bits, not only the parity ones. Exactly half the inputs, picked at
 * random, are given the output 1.
 */
export function createRandomBalancedFunction(
  inputQubitCount: number,
  random: RandomSource = Math.random,
): BooleanFunction {
  assertInputQubitCount(inputQubitCount);
  const inputCount = 2 ** inputQubitCount;

  // Sorting by independent random keys is a uniform shuffle; the first half of the shuffled inputs get a 1.
  const shuffledInputs = Array.from({ length: inputCount }, (_, input) => ({ input, key: random() }))
    .sort((first, second) => first.key - second.key)
    .map(({ input }) => input);

  const outputs = new Array<Bit>(inputCount).fill(0);
  for (const input of shuffledInputs.slice(0, inputCount / 2)) {
    outputs[input] = 1;
  }
  return createFunctionFromTruthTable(outputs);
}

/**
 * CLASSICAL. Every output of the function, in input order: 2^n evaluations.
 * The outputs are checked, so a hand-written BooleanFunction that returns
 * something other than a bit is caught here rather than corrupting a state.
 */
export function truthTable(f: BooleanFunction): Bit[] {
  assertInputQubitCount(f.inputQubitCount);
  return Array.from({ length: 2 ** f.inputQubitCount }, (_, input) => {
    const output: unknown = f.evaluate(input);
    if (!isBit(output)) {
      throw new TypeError(`A Boolean function must return 0 or 1; received ${String(output)} for input ${input}.`);
    }
    return output;
  });
}

/**
 * CLASSICAL. Classifies a function by evaluating it on every input and
 * counting the 1s. This is the ground truth that the quantum algorithm's
 * answer can be checked against — and the brute-force approach it avoids.
 * The Deutsch–Jozsa implementation never calls this.
 */
export function classifyByTruthTable(f: BooleanFunction): BooleanFunctionKind {
  const outputs = truthTable(f);
  const ones = outputs.filter((output) => output === 1).length;

  if (ones === 0 || ones === outputs.length) {
    return 'constant';
  }
  return ones === outputs.length / 2 ? 'balanced' : 'neither';
}
