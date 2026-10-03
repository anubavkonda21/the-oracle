import { describe, expect, it } from 'vitest';
import { ORACLE_INPUT_LENGTH } from '../../src/game/config/oracleConfig';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import { inputAt } from '../../src/game/systems/oracle/inputSpace';
import { ORACLE_KINDS } from '../../src/game/systems/oracle/oracleKind';
import { createPromisedOracle, promisedKind } from '../../src/game/systems/oracle/promise';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';
import {
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

/** Source text of the game's files, for checking that nothing keeps the answer. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return withoutComments(entry[1]);
};

/** The files of the game layer whose code matches a pattern, comments aside. */
const filesMatching = (pattern: RegExp): string[] =>
  Object.entries(gameSources)
    .filter(([, source]) => pattern.test(withoutComments(source)))
    .map(([path]) => path.replace(/^.*\/src\/game\//, ''))
    .sort();

const onesIn = (f: BooleanFunction): number => truthTable(f).filter((output) => output === 1).length;

/** Every function there is of this many bits: all 2^(2^bits) truth tables. */
function everyFunction(bits: number): BooleanFunction[] {
  const inputs = 2 ** bits;
  return Array.from({ length: 2 ** inputs }, (_, code) =>
    createFunctionFromTruthTable(Array.from({ length: inputs }, (__, input): Bit => ((code >> input) & 1) as Bit)),
  );
}

/** A six-bit truth table of 0s, with 1s at the given positions. */
const sixBitTable = (...ones: number[]): Bit[] => Array.from({ length: 64 }, (_, input): Bit => (ones.includes(input) ? 1 : 0));

const firstInputs = (count: number): number[] => Array.from({ length: count }, (_, input) => input);

/** Pinned in tests/game/prototypeOracle.test.ts: everything the prototype machine does. */
const PROTOTYPE_BEHAVIOUR = '0101101010100101010110101010010110100101010110101010010101011010';

describe('the two kinds of machine', () => {
  it('are constant and balanced, and there is no third', () => {
    expect(ORACLE_KINDS).toEqual(['constant', 'balanced']);
  });
});

describe('the promise: a constant function keeps it', () => {
  it.each([1, 2, 3, 4, 5, 6])('whichever output it always gives, for %i bit(s)', (bits) => {
    expect(promisedKind(createConstantFunction(bits, 0))).toBe('constant');
    expect(promisedKind(createConstantFunction(bits, 1))).toBe('constant');
  });

  it('gives the same output for all 64 inputs, for six bits', () => {
    for (const value of [0, 1] as const) {
      const outputs = truthTable(createConstantFunction(6, value));

      expect(outputs).toHaveLength(64);
      expect(new Set(outputs)).toEqual(new Set([value]));
    }
  });
});

describe('the promise: a balanced function keeps it', () => {
  it('for every parity function of one to six bits, inverted or not', () => {
    for (let bits = 1; bits <= 6; bits += 1) {
      for (let mask = 1; mask < 2 ** bits; mask += 1) {
        expect(promisedKind(createParityFunction(bits, mask))).toBe('balanced');
        expect(promisedKind(createParityFunction(bits, mask, true))).toBe('balanced');
      }
    }
  });

  it('with exactly 32 inputs giving 0 and 32 giving 1, for every six-bit parity function', () => {
    for (let mask = 1; mask < 64; mask += 1) {
      const f = createParityFunction(6, mask);

      expect(promisedKind(f)).toBe('balanced');
      expect(onesIn(f)).toBe(32);
      expect(64 - onesIn(f)).toBe(32);
    }
  });

  it('for balanced functions that are not parities at all', () => {
    const random = createSeededRandom(7);
    for (let trial = 0; trial < 50; trial += 1) {
      const f = createRandomBalancedFunction(6, random);

      expect(promisedKind(f)).toBe('balanced');
      expect(onesIn(f)).toBe(32);
    }
  });

  it('however its two halves are arranged', () => {
    // The first 32 inputs give 1, the rest 0 — and the same with the halves swapped.
    expect(promisedKind(createFunctionFromTruthTable(sixBitTable(...firstInputs(32))))).toBe('balanced');
    expect(promisedKind(createBooleanFunction(6, (input) => (input >= 32 ? 1 : 0)))).toBe('balanced');
  });
});

describe('the promise: a function that is neither kind breaks it', () => {
  it.each([
    ['a single 1 among 64 outputs', sixBitTable(17)],
    ['a single 0 among 64 outputs', sixBitTable(...firstInputs(63))],
    ['31 ones and 33 zeros: one short of balanced', sixBitTable(...firstInputs(31))],
    ['33 ones and 31 zeros: one past balanced', sixBitTable(...firstInputs(33))],
    ['a quarter of the inputs giving 1', sixBitTable(...firstInputs(16))],
  ])('refuses %s', (_, outputs) => {
    expect(() => promisedKind(createFunctionFromTruthTable(outputs))).toThrow(RangeError);
  });

  it('refuses the AND and the OR of all six bits', () => {
    expect(() => promisedKind(createBooleanFunction(6, (input) => (input === 63 ? 1 : 0)))).toThrow(RangeError);
    expect(() => promisedKind(createBooleanFunction(6, (input) => (input === 0 ? 0 : 1)))).toThrow(RangeError);
  });

  it('says why', () => {
    expect(() => promisedKind(createFunctionFromTruthTable([0, 0, 0, 1]))).toThrow(/breaks the promise/);
    expect(() => promisedKind(createFunctionFromTruthTable([0, 0, 0, 1]))).toThrow(/neither constant .* nor balanced/);
  });

  it('accepts exactly the 2 constant and 6 balanced functions of two bits, and refuses the other 8', () => {
    const kinds = everyFunction(2).map((f) => {
      try {
        return promisedKind(f);
      } catch {
        return 'refused';
      }
    });

    expect(kinds.filter((kind) => kind === 'constant')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'balanced')).toHaveLength(6);
    expect(kinds.filter((kind) => kind === 'refused')).toHaveLength(8);
  });

  it('accepts exactly the 2 constant and 70 balanced functions of three bits, and refuses the other 184', () => {
    const kinds = everyFunction(3).map((f) => {
      try {
        return promisedKind(f);
      } catch {
        return 'refused';
      }
    });

    expect(kinds.filter((kind) => kind === 'constant')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'balanced')).toHaveLength(70);
    expect(kinds.filter((kind) => kind === 'refused')).toHaveLength(184);
  });

  it('judges by the outputs alone: a function is balanced exactly when half of them are 1', () => {
    for (const f of everyFunction(3)) {
      const ones = onesIn(f);
      const expected = ones === 0 || ones === 8 ? 'constant' : ones === 4 ? 'balanced' : 'refused';

      if (expected === 'refused') {
        expect(() => promisedKind(f)).toThrow(RangeError);
      } else {
        expect(promisedKind(f)).toBe(expected);
      }
    }
  });
});

describe('a machine is only ever built from a function that keeps the promise', () => {
  it('builds an ordinary machine for a constant function and for a balanced one', () => {
    const constant = createPromisedOracle(createConstantFunction(6, 1));
    const balanced = createPromisedOracle(createParityFunction(6, 0b000001));

    expect(constant).toBeInstanceOf(GameOracle);
    expect(balanced).toBeInstanceOf(GameOracle);
    expect(constant.inputLength).toBe(6);
    expect(balanced.inputLength).toBe(6);
  });

  it('builds no machine for a function that breaks it', () => {
    expect(() => createPromisedOracle(createFunctionFromTruthTable(sixBitTable(17)))).toThrow(/breaks the promise/);
    expect(() => createPromisedOracle(createFunctionFromTruthTable([0, 1, 1, 1]))).toThrow(RangeError);
  });

  it('checks every output, not a sample: one stray output anywhere is enough to be refused', () => {
    for (const stray of [0, 1, 31, 32, 62, 63]) {
      expect(() => createPromisedOracle(createFunctionFromTruthTable(sixBitTable(stray)))).toThrow(RangeError);
    }
  });

  it('gives a machine that answers exactly as its hidden function does', () => {
    const f = createParityFunction(4, 0b0110);
    const oracle = createPromisedOracle(f);

    for (let value = 0; value < 16; value += 1) {
      expect(oracle.query(inputAt(value, 4)).output).toBe(f.evaluate(value));
    }
  });

  it('checks the function without using any of the player’s queries', () => {
    let evaluations = 0;
    const oracle = createPromisedOracle(
      createBooleanFunction(3, () => {
        evaluations += 1;
        return 0;
      }),
    );

    expect(evaluations).toBe(8); // every output was looked at, once, to check the promise…
    expect(oracle.queryCount).toBe(0); // …and none of it went on the record
    expect(oracle.history).toEqual([]);
  });

  it('does not keep what it found: a machine carries no mark of its kind', () => {
    const constant = createPromisedOracle(createConstantFunction(6, 0));
    const balanced = createPromisedOracle(createParityFunction(6, 0b101101));

    for (const oracle of [constant, balanced]) {
      expect(Object.keys(oracle)).toEqual(['inputLength']);
      expect(JSON.stringify(oracle)).toBe('{"inputLength":6}');
      expect(Object.getOwnPropertyNames(oracle)).toEqual(['inputLength']);
    }
    expect(Object.getOwnPropertyNames(GameOracle.prototype).sort()).toEqual(['constructor', 'history', 'query', 'queryCount']);
  });

  it('makes machines of the two kinds indistinguishable until they are asked', () => {
    const constant = createPromisedOracle(createConstantFunction(6, 0));
    const balanced = createPromisedOracle(createParityFunction(6, 0b101101));

    expect(JSON.stringify(constant)).toBe(JSON.stringify(balanced));
    expect(constant.queryCount).toBe(balanced.queryCount);
    // 000000 is no help: both answer 0. Only an input they differ on tells them apart.
    expect(constant.query('000000').output).toBe(balanced.query('000000').output);
    expect(constant.query('100000').output).not.toBe(balanced.query('100000').output);
  });
});

describe('the machine in the laboratory keeps the promise', () => {
  const everyAnswer = (): Bit[] => {
    const oracle = createPrototypeOracle();
    return Array.from({ length: 64 }, (_, index) => oracle.query(inputAt(index, ORACLE_INPUT_LENGTH)).output);
  };

  it('is balanced: of its 64 inputs, exactly 32 answer 0 and exactly 32 answer 1', () => {
    const answers = everyAnswer();

    expect(answers).toHaveLength(64);
    expect(answers.filter((output) => output === 0)).toHaveLength(32);
    expect(answers.filter((output) => output === 1)).toHaveLength(32);
  });

  it('is therefore not constant: it gives both outputs', () => {
    expect(new Set(everyAnswer())).toEqual(new Set([0, 1]));
  });

  it('is the same function it has been since the first playable prototype: it was not changed to fit', () => {
    expect(everyAnswer().join('')).toBe(PROTOTYPE_BEHAVIOUR);
    expect(PROTOTYPE_BEHAVIOUR.split('').filter((digit) => digit === '1')).toHaveLength(32);
  });

  it('passes the same check any machine must pass', () => {
    const outputs = PROTOTYPE_BEHAVIOUR.split('').map((digit): Bit => (digit === '1' ? 1 : 0));
    expect(promisedKind(createFunctionFromTruthTable(outputs))).toBe('balanced');
  });

  it('is built through that check, and no other way', () => {
    const source = sourceOf('/systems/oracle/prototypeOracle.ts');

    expect(source).toMatch(/return createPromisedOracle\(createParityFunction\(ORACLE_INPUT_LENGTH, PROTOTYPE_RULE_MASK\)\);/);
    expect(source).not.toMatch(/new GameOracle\(/);
  });

  it('would have been refused had any single one of its answers been different', () => {
    for (let changed = 0; changed < 64; changed += 1) {
      const outputs = PROTOTYPE_BEHAVIOUR.split('').map((digit, input): Bit => {
        const output = digit === '1' ? 1 : 0;
        return input === changed ? ((1 - output) as Bit) : output;
      });
      expect(() => createPromisedOracle(createFunctionFromTruthTable(outputs))).toThrow(/breaks the promise/);
    }
  });

  it('answers 0 to the inputs people try first, so a run of identical answers is easy to come by', () => {
    // Not a requirement — a fact about this machine worth knowing: its record often starts lopsided.
    const oracle = createPrototypeOracle();
    const answers = ['000000', '111111', '101010', '010101', '111000', '000111'].map((input) => oracle.query(input).output);

    expect(answers).toEqual([0, 0, 0, 0, 0, 0]);
    expect(oracle.query('100000').output).toBe(1);
  });
});

describe('nothing in the game holds the answer', () => {
  it('works out the truth table of a hidden function in one place only: the check of the promise', () => {
    expect(filesMatching(/\b(classifyByTruthTable|truthTable)\b/)).toEqual(['systems/oracle/promise.ts']);
  });

  it('evaluates a hidden function in one place only: the machine, answering a query', () => {
    expect(filesMatching(/\.evaluate\(/)).toEqual(['systems/oracle/GameOracle.ts']);
  });

  it('lets only the builder of the machine reach the check', () => {
    expect(filesMatching(/from '\.\/promise'|from '[./]+\/systems\/oracle\/promise'|from '[./]+\/oracle\/promise'/)).toEqual([
      'systems/oracle/prototypeOracle.ts',
    ]);
    expect(filesMatching(/\bpromisedKind\(/)).toEqual(['systems/oracle/promise.ts']);
  });

  it('throws the kind away once it has been checked', () => {
    const source = sourceOf('/systems/oracle/promise.ts');

    // The result of the check is not assigned, returned or stored when a machine is built.
    expect(source).toMatch(/\n {2}promisedKind\(hiddenFunction\);\s*\n {2}return new GameOracle\(hiddenFunction\);/);
  });
});
