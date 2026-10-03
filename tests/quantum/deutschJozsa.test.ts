import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_QUBIT_COUNT,
  QuantumState,
  classifyByTruthTable,
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createOracle,
  createParityFunction,
  createRandomBalancedFunction,
  runDeutschJozsa,
  truthTable,
  type Bit,
  type BooleanFunction,
  type DeutschJozsaResult,
  type DeutschJozsaStepId,
  type QuantumOracle,
} from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';
import { PRECISION, allTruthTables, expectStatesEqual } from './helpers';

const run = (f: BooleanFunction): DeutschJozsaResult => runDeutschJozsa(createOracle(f));

/** The majority function of 3 bits: balanced, but not a parity function. */
const MAJORITY: readonly Bit[] = [0, 0, 0, 1, 0, 1, 1, 1];

function stateAt(result: DeutschJozsaResult, id: DeutschJozsaStepId): QuantumState {
  const step = result.steps.find((candidate) => candidate.id === id);
  if (!step) {
    throw new Error(`The run has no "${id}" step.`);
  }
  return step.state;
}

describe('Deutsch–Jozsa: constant functions', () => {
  it.each([1, 2, 3, 4, 5, 6, 8, 10])('finds both constant functions of %i bit(s) constant', (inputQubitCount) => {
    for (const value of [0, 1] as const) {
      const result = run(createConstantFunction(inputQubitCount, value));

      expect(result.verdict).toBe('constant');
      expect(result.measuredInput).toBe(0);
      expect(result.measuredLabel).toBe('0'.repeat(inputQubitCount));
      expect(result.inputProbabilities[0]).toBeCloseTo(1, PRECISION);
    }
  });

  it('measures all zeros with certainty, whatever the random source', () => {
    const oracle = createOracle(createConstantFunction(3, 1));
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      expect(runDeutschJozsa(oracle, random).measuredInput).toBe(0);
    }
    for (let trial = 0; trial < 300; trial += 1) {
      expect(runDeutschJozsa(oracle).verdict).toBe('constant');
    }
  });
});

describe('Deutsch–Jozsa: balanced functions', () => {
  it('finds every parity function of 1 to 5 bits balanced, and measures exactly its mask', () => {
    // For f(x) = x·s the interference is total: the input register reads s with certainty.
    // The verdict only needs "not all zeros"; reading back the precise mask shows the amplitudes are right.
    for (const inputQubitCount of [1, 2, 3, 4, 5]) {
      for (let mask = 1; mask < 2 ** inputQubitCount; mask += 1) {
        for (const invert of [false, true]) {
          const result = run(createParityFunction(inputQubitCount, mask, invert));

          expect(result.verdict).toBe('balanced');
          expect(result.measuredInput).toBe(mask);
          expect(result.inputProbabilities[mask]).toBeCloseTo(1, PRECISION);
          expect(result.inputProbabilities[0]).toBeCloseTo(0, PRECISION);
        }
      }
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 8, 10])('finds random balanced functions of %i bit(s) balanced', (inputQubitCount) => {
    for (let seed = 0; seed < 20; seed += 1) {
      const result = run(createRandomBalancedFunction(inputQubitCount, createSeededRandom(400 + seed)));

      expect(result.verdict).toBe('balanced');
      expect(result.measuredInput).not.toBe(0);
      expect(result.inputProbabilities[0]).toBeCloseTo(0, PRECISION);
    }
  });

  it('never measures all zeros, although the result itself can vary from run to run', () => {
    // Majority spreads its probability evenly over 001, 010, 100 and 111.
    const oracle = createOracle(createFunctionFromTruthTable(MAJORITY));
    const seen = new Set<string>();

    for (let trial = 0; trial < 400; trial += 1) {
      const result = runDeutschJozsa(oracle);
      expect(result.verdict).toBe('balanced');
      seen.add(result.measuredLabel);
    }
    expect(seen).toEqual(new Set(['001', '010', '100', '111']));
  });

  it('reports the probabilities the interference actually produces', () => {
    const { inputProbabilities } = run(createFunctionFromTruthTable(MAJORITY));
    const expected = [0, 0.25, 0.25, 0, 0.25, 0, 0, 0.25];
    expected.forEach((probability, x) => expect(inputProbabilities[x]).toBeCloseTo(probability, PRECISION));
  });
});

describe('Deutsch–Jozsa: checked against the truth table, exhaustively', () => {
  it.each([1, 2, 3])('agrees with brute force on every promised function of %i bit(s)', (inputQubitCount) => {
    let promised = 0;
    for (const outputs of allTruthTables(inputQubitCount)) {
      const f = createFunctionFromTruthTable(outputs);
      const truth = classifyByTruthTable(f);
      if (truth === 'neither') {
        continue;
      }
      promised += 1;
      expect(run(f).verdict).toBe(truth);
    }
    expect(promised).toBe({ 1: 4, 2: 8, 3: 72 }[inputQubitCount]);
  });

  it('agrees with brute force on all 12,872 promised functions of 4 bits', () => {
    let constant = 0;
    let balanced = 0;

    for (const outputs of allTruthTables(4)) {
      const ones = outputs.reduce<number>((count, output) => count + output, 0);
      if (ones !== 0 && ones !== 8 && ones !== 16) {
        continue;
      }
      const verdict = run(createFunctionFromTruthTable(outputs)).verdict;

      if (ones === 8) {
        balanced += 1;
        expect(verdict).toBe('balanced');
      } else {
        constant += 1;
        expect(verdict).toBe('constant');
      }
    }

    expect(constant).toBe(2);
    expect(balanced).toBe(12_870); // 16 choose 8
  });

  it('works at the largest size the engine allows', () => {
    const constant = run(createConstantFunction(MAX_INPUT_QUBIT_COUNT, 1));
    expect(constant.verdict).toBe('constant');

    const mask = 0b101_0011_0000_1101;
    const balanced = run(createParityFunction(MAX_INPUT_QUBIT_COUNT, mask));
    expect(balanced.verdict).toBe('balanced');
    expect(balanced.measuredInput).toBe(mask);
  });
});

describe('Deutsch–Jozsa: the verdict comes from the simulation', () => {
  it('queries the oracle exactly once', () => {
    for (const f of [createConstantFunction(4, 0), createParityFunction(4, 0b1001), createFunctionFromTruthTable(MAJORITY)]) {
      const oracle = createOracle(f);
      const result = runDeutschJozsa(oracle);

      expect(result.oracleQueries).toBe(1);
      expect(oracle.queryCount).toBe(1);
    }
  });

  it('counts each run separately when an oracle is reused', () => {
    const oracle = createOracle(createParityFunction(3, 0b010));
    expect(runDeutschJozsa(oracle).oracleQueries).toBe(1);
    expect(runDeutschJozsa(oracle).oracleQueries).toBe(1);
    expect(oracle.queryCount).toBe(2);
  });

  it('never evaluates the function itself', () => {
    let evaluations = 0;
    const counted = createBooleanFunction(4, (input) => {
      evaluations += 1;
      return input < 8 ? 0 : 1;
    });

    const oracle = createOracle(counted);
    const evaluationsToBuildTheOracle = evaluations;
    expect(evaluationsToBuildTheOracle).toBe(16);

    expect(runDeutschJozsa(oracle).verdict).toBe('balanced');
    expect(evaluations).toBe(evaluationsToBuildTheOracle);
  });

  it('ignores anything a function claims about itself', () => {
    const mislabelledBalanced = {
      ...createParityFunction(3, 0b111),
      kind: 'constant',
      isConstant: true,
    };
    const mislabelledConstant = {
      ...createConstantFunction(3, 1),
      kind: 'balanced',
      isBalanced: true,
    };

    expect(run(mislabelledBalanced).verdict).toBe('balanced');
    expect(run(mislabelledConstant).verdict).toBe('constant');
  });

  it('works through any oracle with the right interface, knowing nothing of the function behind it', () => {
    // A hand-made oracle for f(x) = last bit of x, on 2 input bits: flip the ancilla when that bit is 1.
    let queries = 0;
    const handMade: QuantumOracle = {
      inputQubitCount: 2,
      qubitCount: 3,
      get queryCount() {
        return queries;
      },
      applyTo(state) {
        queries += 1;
        return state.applyBasisPermutation((index) => index ^ ((index >> 1) & 1));
      },
    };

    const result = runDeutschJozsa(handMade);
    expect(result.verdict).toBe('balanced');
    expect(result.measuredLabel).toBe('01');
    expect(result.oracleQueries).toBe(1);
  });

  it('gives a different verdict when only the oracle changes', () => {
    // Same code path, same random source; the answer follows the oracle.
    const fixed = (): number => 0.5;
    expect(runDeutschJozsa(createOracle(createConstantFunction(3, 0)), fixed).verdict).toBe('constant');
    expect(runDeutschJozsa(createOracle(createParityFunction(3, 0b100)), fixed).verdict).toBe('balanced');
  });
});

describe('Deutsch–Jozsa: the circuit, step by step', () => {
  const f = createFunctionFromTruthTable(MAJORITY);
  const outputs = truthTable(f);
  const result = run(f);
  const inputCount = 8;

  it('records every stage in order', () => {
    expect(result.steps.map((step) => step.id)).toEqual([
      'prepared',
      'superposed',
      'ancilla-ready',
      'queried',
      'interfered',
      'measured',
    ]);
  });

  it('starts with every qubit in |0⟩', () => {
    expectStatesEqual(stateAt(result, 'prepared'), QuantumState.basis(4, 0));
  });

  it('puts the input register in a uniform superposition, the ancilla still |0⟩', () => {
    const state = stateAt(result, 'superposed');
    for (let x = 0; x < inputCount; x += 1) {
      expect(state.getAmplitude(2 * x).real).toBeCloseTo(1 / Math.sqrt(8), PRECISION);
      expect(state.getAmplitude(2 * x + 1).real).toBeCloseTo(0, PRECISION);
    }
  });

  it('prepares the ancilla in |−⟩: equal magnitudes, opposite signs', () => {
    const state = stateAt(result, 'ancilla-ready');
    for (let x = 0; x < inputCount; x += 1) {
      expect(state.getAmplitude(2 * x).real).toBeCloseTo(0.25, PRECISION);
      expect(state.getAmplitude(2 * x + 1).real).toBeCloseTo(-0.25, PRECISION);
    }
  });

  it('shows phase kickback after the query: each input carries (−1)^f(x), and the ancilla is still |−⟩', () => {
    const state = stateAt(result, 'queried');
    outputs.forEach((output, x) => {
      const sign = output === 1 ? -1 : 1;
      expect(state.getAmplitude(2 * x).real).toBeCloseTo(sign * 0.25, PRECISION);
      expect(state.getAmplitude(2 * x + 1).real).toBeCloseTo(-sign * 0.25, PRECISION);
    });
  });

  it('changes no probability with the query — only signs', () => {
    const before = stateAt(result, 'ancilla-ready').getProbabilities();
    const after = stateAt(result, 'queried').getProbabilities();
    after.forEach((probability, index) => expect(probability).toBeCloseTo(before[index] ?? Number.NaN, PRECISION));
  });

  it('turns those signs into probabilities with the second round of Hadamards', () => {
    // Amplitude of |z⟩ on the input register is (1/2^n) Σₓ (−1)^(f(x) + x·z).
    const state = stateAt(result, 'interfered');
    const parity = (value: number): number => {
      let bits = value;
      let odd = 0;
      while (bits !== 0) {
        odd ^= bits & 1;
        bits >>= 1;
      }
      return odd;
    };

    for (let z = 0; z < inputCount; z += 1) {
      let sum = 0;
      outputs.forEach((output, x) => {
        sum += (output + parity(x & z)) % 2 === 0 ? 1 : -1;
      });
      const expectedAmplitude = sum / inputCount;

      expect(state.getAmplitude(2 * z).real).toBeCloseTo(expectedAmplitude * Math.SQRT1_2, PRECISION);
      expect(result.inputProbabilities[z]).toBeCloseTo(expectedAmplitude ** 2, PRECISION);
    }
  });

  it('collapses the input register onto the measured value and leaves the ancilla unmeasured in |−⟩', () => {
    const state = stateAt(result, 'measured');
    const inputProbabilities = state.getMarginalProbabilities([0, 1, 2]);

    expect(inputProbabilities[result.measuredInput]).toBeCloseTo(1, PRECISION);
    expect(state.getMarginalProbabilities([3])[0]).toBeCloseTo(0.5, PRECISION);
    expect(state.getMarginalProbabilities([3])[1]).toBeCloseTo(0.5, PRECISION);

    // |−⟩ on the ancilla: the two surviving amplitudes are equal and opposite.
    const zeroAmplitude = state.getAmplitude(2 * result.measuredInput);
    const oneAmplitude = state.getAmplitude(2 * result.measuredInput + 1);
    expect(zeroAmplitude.add(oneAmplitude).magnitude()).toBeCloseTo(0, PRECISION);
  });

  it('keeps every state normalised', () => {
    for (const step of result.steps) {
      expect(step.state.isNormalized()).toBe(true);
    }
  });

  it('hands out independent snapshots', () => {
    const fresh = run(f);
    stateAt(fresh, 'queried').applyHadamardAll();
    expectStatesEqual(stateAt(fresh, 'prepared'), QuantumState.basis(4, 0));
    expect(stateAt(fresh, 'interfered').equals(stateAt(fresh, 'queried'))).toBe(false);
  });
});

describe('Deutsch–Jozsa: global phase', () => {
  it('gives constant 0 and constant 1 opposite amplitudes but the same certain result', () => {
    const zero = run(createConstantFunction(2, 0));
    const one = run(createConstantFunction(2, 1));

    // Before measuring: ±|00⟩|−⟩. The overall sign differs; no measurement can tell.
    expect(stateAt(zero, 'interfered').getAmplitude(0).real).toBeCloseTo(Math.SQRT1_2, PRECISION);
    expect(stateAt(one, 'interfered').getAmplitude(0).real).toBeCloseTo(-Math.SQRT1_2, PRECISION);
    expect(zero.inputProbabilities).toEqual(one.inputProbabilities.map((probability) => probability));
    expect(zero.verdict).toBe(one.verdict);
  });
});

describe('Deutsch–Jozsa: when the promise is broken', () => {
  it('refuses to give a verdict for a function that is neither constant nor balanced', () => {
    const and = createFunctionFromTruthTable([0, 0, 0, 1]);
    expect(() => run(and)).toThrow(/promise does not hold/);
  });

  it('detects it from the quantum state: all zeros is neither certain nor impossible', () => {
    // AND of 2 bits: amplitude of |00⟩ is (3 − 1)/4, so its probability is 0.25.
    expect(() => run(createFunctionFromTruthTable([0, 0, 0, 1]))).toThrow(/probability 0\.25/);
  });

  it.each([2, 3])('refuses every function of %i bits that breaks the promise', (inputQubitCount) => {
    let refused = 0;
    for (const outputs of allTruthTables(inputQubitCount)) {
      const f = createFunctionFromTruthTable(outputs);
      if (classifyByTruthTable(f) === 'neither') {
        expect(() => run(f)).toThrow(/promise does not hold/);
        refused += 1;
      }
    }
    expect(refused).toBe({ 2: 8, 3: 184 }[inputQubitCount]);
  });
});
