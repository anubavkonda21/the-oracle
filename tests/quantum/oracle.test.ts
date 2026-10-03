import { describe, expect, it } from 'vitest';
import {
  Gates,
  QuantumState,
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createOracle,
  createParityFunction,
  createRandomBalancedFunction,
  truthTable,
  type Bit,
  type BooleanFunction,
} from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';
import { PRECISION, allTruthTables, arbitraryState, expectStatesEqual, tensorProduct } from './helpers';

const zero = (): QuantumState => QuantumState.basis(1, 0);
const one = (): QuantumState => QuantumState.basis(1, 1);
const plus = (): QuantumState => zero().applyGate(Gates.H, 0); // (|0⟩ + |1⟩)/√2
const minus = (): QuantumState => one().applyGate(Gates.H, 0); // (|0⟩ − |1⟩)/√2

/** A varied set of functions: constant, parity, arbitrary ("neither") and random balanced. */
const sampleFunctions = (): BooleanFunction[] => [
  createConstantFunction(1, 0),
  createConstantFunction(2, 1),
  createParityFunction(2, 0b11),
  createParityFunction(3, 0b101, true),
  createFunctionFromTruthTable([0, 0, 0, 1]), // AND — neither constant nor balanced
  createFunctionFromTruthTable([0, 1, 1, 1, 0, 0, 1, 0]),
  createRandomBalancedFunction(4, createSeededRandom(301)),
];

describe('createOracle', () => {
  it('acts on the input register plus one ancilla', () => {
    const oracle = createOracle(createConstantFunction(3, 0));
    expect(oracle.inputQubitCount).toBe(3);
    expect(oracle.qubitCount).toBe(4);
  });

  it('refuses a state of the wrong size, without counting a query', () => {
    const oracle = createOracle(createConstantFunction(2, 0));
    expect(() => oracle.applyTo(QuantumState.basis(2, 0))).toThrow(/acts on 3 qubits/);
    expect(() => oracle.applyTo(QuantumState.basis(4, 0))).toThrow(/acts on 3 qubits/);
    expect(oracle.queryCount).toBe(0);
  });

  it('applies in place and returns the state', () => {
    const oracle = createOracle(createConstantFunction(1, 1));
    const state = QuantumState.basis(2, 0);
    expect(oracle.applyTo(state)).toBe(state);
  });
});

describe('oracle: U_f |x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩', () => {
  it('holds for every basis state of every sample function', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);
      const inputCount = 2 ** f.inputQubitCount;

      for (let x = 0; x < inputCount; x += 1) {
        for (const y of [0, 1] as const) {
          const state = QuantumState.basis(oracle.qubitCount, 2 * x + y);
          oracle.applyTo(state);

          const expectedIndex = 2 * x + (y ^ f.evaluate(x));
          expectStatesEqual(state, QuantumState.basis(oracle.qubitCount, expectedIndex));
        }
      }
    }
  });

  it('holds for every one of the 256 functions of 3 bits', () => {
    for (const outputs of allTruthTables(3)) {
      const oracle = createOracle(createFunctionFromTruthTable(outputs));

      outputs.forEach((output, x) => {
        const state = oracle.applyTo(QuantumState.basis(4, 2 * x));
        expect(state.getProbabilities().indexOf(1)).toBe(2 * x + output);
      });
    }
  });

  it('never changes the input register', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);
      const inputQubits = Array.from({ length: f.inputQubitCount }, (_, qubit) => qubit);
      const state = arbitraryState(oracle.qubitCount, 310);

      const before = state.getMarginalProbabilities(inputQubits);
      oracle.applyTo(state);
      const after = state.getMarginalProbabilities(inputQubits);

      after.forEach((probability, x) => expect(probability).toBeCloseTo(before[x] ?? Number.NaN, PRECISION));
    }
  });

  it('leaves every state alone when f is constant 0, and flips the ancilla of every state when f is constant 1', () => {
    const original = arbitraryState(3, 311);

    const untouched = createOracle(createConstantFunction(2, 0)).applyTo(original.clone());
    expectStatesEqual(untouched, original);

    const flipped = createOracle(createConstantFunction(2, 1)).applyTo(original.clone());
    expectStatesEqual(flipped, original.clone().applyGate(Gates.X, 2));
  });
});

describe('oracle: a valid quantum operation', () => {
  it('is its own inverse: applying it twice restores any state', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);
      const original = arbitraryState(oracle.qubitCount, 320);

      const twice = original.clone();
      oracle.applyTo(twice);
      oracle.applyTo(twice);
      expectStatesEqual(twice, original);
    }
  });

  it('preserves the norm of any state', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);
      const state = oracle.applyTo(arbitraryState(oracle.qubitCount, 321));
      expect(state.normSquared()).toBeCloseTo(1, PRECISION);
    }
  });

  it('is unitary even for a function that is not reversible itself', () => {
    // f(x) = 0 for every x loses all information about x, yet U_f is still a permutation of basis states.
    const oracle = createOracle(createConstantFunction(3, 0));
    const reached = new Set<number>();
    for (let index = 0; index < 16; index += 1) {
      reached.add(oracle.applyTo(QuantumState.basis(4, index)).getProbabilities().indexOf(1));
    }
    expect(reached.size).toBe(16);
  });

  it('is linear: it acts on each term of a superposition separately', () => {
    const f = createFunctionFromTruthTable([0, 1, 1, 1]);
    const oracle = createOracle(f);
    const state = arbitraryState(3, 322);
    const amplitudes = state.getAmplitudes();

    oracle.applyTo(state);

    amplitudes.forEach((amplitude, index) => {
      const target = index ^ f.evaluate(index >> 1);
      expect(state.getAmplitude(target).equals(amplitude)).toBe(true);
    });
  });
});

describe('oracle: phase kickback', () => {
  it('with the ancilla in |−⟩, multiplies |x⟩ by (−1)^f(x) and leaves the ancilla as |−⟩', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);

      for (let x = 0; x < 2 ** f.inputQubitCount; x += 1) {
        const input = QuantumState.basis(f.inputQubitCount, x);
        const state = oracle.applyTo(tensorProduct(input, minus()));

        const sign = f.evaluate(x) === 1 ? -1 : 1;
        const expected = tensorProduct(input, minus());
        expectStatesEqual(
          state,
          QuantumState.fromAmplitudes(expected.getAmplitudes().map((amplitude) => amplitude.scale(sign))),
        );
      }
    }
  });

  it('with the ancilla in |+⟩, does nothing at all', () => {
    for (const f of sampleFunctions()) {
      const oracle = createOracle(f);
      const original = tensorProduct(arbitraryState(f.inputQubitCount, 330), plus());
      expectStatesEqual(oracle.applyTo(original.clone()), original);
    }
  });

  it('on a superposition of inputs, writes each sign onto its own term', () => {
    // Uniform superposition over x, ancilla |−⟩: afterwards the amplitude of |x⟩ carries (−1)^f(x).
    const f = createFunctionFromTruthTable([0, 1, 1, 0, 1, 0, 0, 1]);
    const uniform = QuantumState.basis(3, 0).applyHadamardAll();
    const state = createOracle(f).applyTo(tensorProduct(uniform, minus()));

    truthTable(f).forEach((output, x) => {
      const sign = output === 1 ? -1 : 1;
      expect(state.getAmplitude(2 * x).real).toBeCloseTo(sign / 4, PRECISION); //  (1/√8)(1/√2)
      expect(state.getAmplitude(2 * x + 1).real).toBeCloseTo(-sign / 4, PRECISION);
    });
  });

  it('with the ancilla in |0⟩, records f(x) in the ancilla instead and changes no sign', () => {
    const f = createParityFunction(2, 0b11);
    const state = createOracle(f).applyTo(tensorProduct(QuantumState.basis(2, 0).applyHadamardAll(), zero()));

    for (let x = 0; x < 4; x += 1) {
      const output = f.evaluate(x);
      expect(state.getAmplitude(2 * x + output).real).toBeCloseTo(0.5, PRECISION);
      expect(state.getAmplitude(2 * x + (1 - output)).real).toBeCloseTo(0, PRECISION);
    }
  });
});

describe('oracle: a black box', () => {
  it('counts one query per application', () => {
    const oracle = createOracle(createParityFunction(2, 0b01));
    expect(oracle.queryCount).toBe(0);

    oracle.applyTo(QuantumState.basis(3, 0));
    expect(oracle.queryCount).toBe(1);

    oracle.applyTo(QuantumState.basis(3, 5));
    oracle.applyTo(QuantumState.basis(3, 2));
    expect(oracle.queryCount).toBe(3);
  });

  it('does not let its query count be overwritten', () => {
    const oracle = createOracle(createConstantFunction(1, 0));
    expect(() => {
      (oracle as { queryCount: number }).queryCount = 99;
    }).toThrow(TypeError);
    expect(oracle.queryCount).toBe(0);
  });

  it('exposes nothing about the function beyond its size', () => {
    const outputs: Bit[] = [0, 1, 1, 0, 1, 0, 0, 1];
    const oracle = createOracle(createFunctionFromTruthTable(outputs));

    expect(Object.keys(oracle).sort()).toEqual(['inputQubitCount', 'qubitCount']);
    expect(JSON.stringify(oracle)).toBe('{"inputQubitCount":3,"qubitCount":4}');
  });

  it('fixes the function when it is built, and never consults it again', () => {
    let evaluations = 0;
    const counted = createBooleanFunction(3, (input) => {
      evaluations += 1;
      return input % 2 === 0 ? 0 : 1;
    });

    const oracle = createOracle(counted);
    expect(evaluations).toBe(8); // one per input, to build the unitary

    oracle.applyTo(QuantumState.basis(4, 0).applyHadamardAll());
    oracle.applyTo(arbitraryState(4, 340));
    expect(evaluations).toBe(8);
  });

  it('rejects a function that does not return bits', () => {
    const broken: BooleanFunction = { inputQubitCount: 1, evaluate: () => 3 as unknown as Bit };
    expect(() => createOracle(broken)).toThrow(/must return 0 or 1/);
  });
});
