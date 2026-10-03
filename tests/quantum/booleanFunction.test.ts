import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_QUBIT_COUNT,
  MAX_QUBIT_COUNT,
  classifyByTruthTable,
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createParityFunction,
  createRandomBalancedFunction,
  truthTable,
  type Bit,
  type BooleanFunction,
} from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';
import { allTruthTables } from './helpers';

const countOnes = (outputs: readonly Bit[]): number => outputs.filter((output) => output === 1).length;

describe('createBooleanFunction', () => {
  it('evaluates the rule it was given', () => {
    const isOdd = createBooleanFunction(3, (input) => (input % 2 === 1 ? 1 : 0));
    expect(isOdd.inputQubitCount).toBe(3);
    expect(truthTable(isOdd)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it.each([-1, 8, 2.5, Number.NaN])('rejects input %s for a 3-bit function', (input) => {
    const f = createBooleanFunction(3, () => 0);
    expect(() => f.evaluate(input)).toThrow(/out of range/);
  });

  it('rejects a rule that returns something other than a bit', () => {
    const broken = createBooleanFunction(1, () => 2 as unknown as Bit);
    expect(() => broken.evaluate(0)).toThrow(/must return 0 or 1/);
  });

  it.each([0, -1, 1.5, MAX_INPUT_QUBIT_COUNT + 1])('rejects an input qubit count of %s', (inputQubitCount) => {
    expect(() => createBooleanFunction(inputQubitCount, () => 0)).toThrow(/Input qubit count/);
  });

  it('reserves one qubit of the engine for the ancilla', () => {
    expect(MAX_INPUT_QUBIT_COUNT).toBe(MAX_QUBIT_COUNT - 1);
  });

  it('cannot be altered after creation', () => {
    expect(Object.isFrozen(createBooleanFunction(2, () => 0))).toBe(true);
  });
});

describe('createConstantFunction', () => {
  it.each([0, 1] as const)('returns %i for every input', (value) => {
    for (const inputQubitCount of [1, 2, 3, 5]) {
      const outputs = truthTable(createConstantFunction(inputQubitCount, value));
      expect(outputs).toHaveLength(2 ** inputQubitCount);
      expect(outputs.every((output) => output === value)).toBe(true);
    }
  });

  it('is classified as constant', () => {
    expect(classifyByTruthTable(createConstantFunction(4, 0))).toBe('constant');
    expect(classifyByTruthTable(createConstantFunction(4, 1))).toBe('constant');
  });

  it('rejects a value that is not a bit', () => {
    expect(() => createConstantFunction(2, 2 as unknown as Bit)).toThrow(/must be 0 or 1/);
  });
});

describe('createParityFunction', () => {
  it('computes the parity of the selected bits', () => {
    // mask 0b101 selects qubits 0 and 2 (the outer characters of the label).
    const f = createParityFunction(3, 0b101);
    expect(f.evaluate(0b000)).toBe(0);
    expect(f.evaluate(0b100)).toBe(1);
    expect(f.evaluate(0b001)).toBe(1);
    expect(f.evaluate(0b101)).toBe(0);
    expect(f.evaluate(0b010)).toBe(0); // the middle bit is not selected
    expect(f.evaluate(0b111)).toBe(0);
  });

  it('with a single selected bit, simply returns that bit', () => {
    expect(truthTable(createParityFunction(2, 0b01))).toEqual([0, 1, 0, 1]);
    expect(truthTable(createParityFunction(2, 0b10))).toEqual([0, 0, 1, 1]);
  });

  it('inverts every output when asked', () => {
    const plain = truthTable(createParityFunction(3, 0b110));
    const inverted = truthTable(createParityFunction(3, 0b110, true));
    expect(inverted).toEqual(plain.map((output) => 1 - output));
  });

  it('is balanced for every non-zero mask, inverted or not', () => {
    for (const inputQubitCount of [1, 2, 3, 4]) {
      for (let mask = 1; mask < 2 ** inputQubitCount; mask += 1) {
        expect(classifyByTruthTable(createParityFunction(inputQubitCount, mask))).toBe('balanced');
        expect(classifyByTruthTable(createParityFunction(inputQubitCount, mask, true))).toBe('balanced');
      }
    }
  });

  it.each([0, 8, -1, 1.5])('rejects mask %s for 3 bits', (mask) => {
    expect(() => createParityFunction(3, mask)).toThrow(/parity mask/);
  });
});

describe('createFunctionFromTruthTable', () => {
  it('returns the listed output for each input', () => {
    const outputs: Bit[] = [0, 1, 1, 0, 1, 0, 0, 0];
    const f = createFunctionFromTruthTable(outputs);

    expect(f.inputQubitCount).toBe(3);
    expect(truthTable(f)).toEqual(outputs);
  });

  it('infers the bit count from the table length', () => {
    expect(createFunctionFromTruthTable([0, 1]).inputQubitCount).toBe(1);
    expect(createFunctionFromTruthTable(new Array<Bit>(16).fill(1)).inputQubitCount).toBe(4);
  });

  it('copies the table, so later changes to the array do not change the function', () => {
    const outputs: Bit[] = [0, 0, 1, 1];
    const f = createFunctionFromTruthTable(outputs);
    outputs.fill(1);
    expect(truthTable(f)).toEqual([0, 0, 1, 1]);
  });

  it.each([0, 1, 3, 6, 12])('rejects a table of %i outputs, which is not 2^n for n ≥ 1', (length) => {
    expect(() => createFunctionFromTruthTable(new Array<Bit>(length).fill(0))).toThrow(/2\^n outputs/);
  });

  it('rejects entries that are not bits', () => {
    expect(() => createFunctionFromTruthTable([0, 2 as unknown as Bit])).toThrow(/must be 0 or 1/);
    expect(() => createFunctionFromTruthTable([true as unknown as Bit, 0])).toThrow(/must be 0 or 1/);
  });
});

describe('createRandomBalancedFunction', () => {
  it.each([1, 2, 3, 4, 6, 8])('outputs 1 for exactly half of the inputs of a %i-bit function', (inputQubitCount) => {
    for (let trial = 0; trial < 25; trial += 1) {
      const outputs = truthTable(createRandomBalancedFunction(inputQubitCount));
      expect(countOnes(outputs)).toBe(2 ** inputQubitCount / 2);
    }
  });

  it('is reproducible for a given seed and varies between seeds', () => {
    const generate = (seed: number): Bit[] => truthTable(createRandomBalancedFunction(4, createSeededRandom(seed)));

    expect(generate(7)).toEqual(generate(7));
    expect(generate(7)).not.toEqual(generate(8));
  });

  it('reaches balanced functions that are not parity functions', () => {
    // Of the 70 balanced functions of 3 bits only 14 are parities (7 masks, each plain or inverted).
    const parityTables = new Set<string>();
    for (let mask = 1; mask < 8; mask += 1) {
      parityTables.add(truthTable(createParityFunction(3, mask)).join(''));
      parityTables.add(truthTable(createParityFunction(3, mask, true)).join(''));
    }
    expect(parityTables.size).toBe(14);

    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      seen.add(truthTable(createRandomBalancedFunction(3, createSeededRandom(seed))).join(''));
    }
    const nonParity = [...seen].filter((table) => !parityTables.has(table));
    expect(seen.size).toBeGreaterThan(40);
    expect(nonParity.length).toBeGreaterThan(20);
  });

  it('stays balanced even if the random source is degenerate', () => {
    expect(countOnes(truthTable(createRandomBalancedFunction(3, () => 0)))).toBe(4);
    expect(countOnes(truthTable(createRandomBalancedFunction(3, () => 0.999999)))).toBe(4);
  });
});

describe('truthTable', () => {
  it('lists every output in input order', () => {
    expect(truthTable(createBooleanFunction(2, (input) => (input === 3 ? 1 : 0)))).toEqual([0, 0, 0, 1]);
  });

  it('catches a hand-written function that returns something other than a bit', () => {
    const handWritten: BooleanFunction = { inputQubitCount: 1, evaluate: () => 7 as unknown as Bit };
    expect(() => truthTable(handWritten)).toThrow(/must return 0 or 1/);
  });
});

describe('classifyByTruthTable', () => {
  it('recognises constant, balanced and neither', () => {
    expect(classifyByTruthTable(createFunctionFromTruthTable([1, 1, 1, 1]))).toBe('constant');
    expect(classifyByTruthTable(createFunctionFromTruthTable([0, 1, 1, 0]))).toBe('balanced');
    expect(classifyByTruthTable(createFunctionFromTruthTable([0, 0, 0, 1]))).toBe('neither'); // AND
    expect(classifyByTruthTable(createFunctionFromTruthTable([0, 1, 1, 1]))).toBe('neither'); // OR
  });

  it.each([
    { inputQubitCount: 1, constant: 2, balanced: 2, neither: 0 },
    { inputQubitCount: 2, constant: 2, balanced: 6, neither: 8 },
    { inputQubitCount: 3, constant: 2, balanced: 70, neither: 184 },
  ])(
    'counts $constant constant, $balanced balanced and $neither other functions of $inputQubitCount bit(s)',
    ({ inputQubitCount, constant, balanced, neither }) => {
      const counts = { constant: 0, balanced: 0, neither: 0 };
      for (const outputs of allTruthTables(inputQubitCount)) {
        counts[classifyByTruthTable(createFunctionFromTruthTable(outputs))] += 1;
      }
      expect(counts).toEqual({ constant, balanced, neither });
    },
  );
});
