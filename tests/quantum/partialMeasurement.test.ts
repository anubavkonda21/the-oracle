import { describe, expect, it } from 'vitest';
import { Gates, QuantumState } from '../../src/quantum';
import { PRECISION, arbitraryState, expectAmplitudes, expectStatesEqual, tensorProduct } from './helpers';

const INVERSE_SQRT_2 = Math.SQRT1_2;

const bellState = (): QuantumState => QuantumState.fromAmplitudes([1, 0, 0, 1]).normalize(); // (|00⟩ + |11⟩)/√2
const plusState = (): QuantumState => QuantumState.basis(1, 0).applyGate(Gates.H, 0);

function expectProbabilities(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((probability, index) => {
    expect(actual[index]).toBeCloseTo(probability, PRECISION);
  });
}

describe('QuantumState.getMarginalProbabilities', () => {
  it('gives each factor of a product state its own probabilities', () => {
    const left = QuantumState.fromAmplitudes([0.6, 0.8]); // P = 0.36, 0.64
    const right = QuantumState.fromAmplitudes([Math.sqrt(0.1), Math.sqrt(0.9)]); // P = 0.1, 0.9
    const state = tensorProduct(left, right);

    expectProbabilities(state.getMarginalProbabilities([0]), [0.36, 0.64]);
    expectProbabilities(state.getMarginalProbabilities([1]), [0.1, 0.9]);
  });

  it('shows each half of a Bell pair as an even coin, though together they always agree', () => {
    const state = bellState();
    expectProbabilities(state.getMarginalProbabilities([0]), [0.5, 0.5]);
    expectProbabilities(state.getMarginalProbabilities([1]), [0.5, 0.5]);
    expectProbabilities(state.getMarginalProbabilities([0, 1]), [0.5, 0, 0, 0.5]);
  });

  it('equals the full distribution when every qubit is listed in order', () => {
    const state = arbitraryState(3, 201);
    expectProbabilities(state.getMarginalProbabilities([0, 1, 2]), state.getProbabilities());
  });

  it('indexes a result by the listed qubits, in the order listed', () => {
    const state = QuantumState.basis(3, 0b110); // qubit 0 = 1, qubit 1 = 1, qubit 2 = 0

    expect(state.getMarginalProbabilities([0, 2])).toEqual([0, 0, 1, 0]); // "10"
    expect(state.getMarginalProbabilities([2, 0])).toEqual([0, 1, 0, 0]); // "01"
    expect(state.getMarginalProbabilities([2])).toEqual([1, 0]); // "0"
  });

  it('sums to 1 for a normalised state, whichever qubits are chosen', () => {
    const state = arbitraryState(4, 202);
    for (const qubits of [[0], [3], [1, 2], [3, 0, 2], [0, 1, 2, 3]]) {
      const total = state.getMarginalProbabilities(qubits).reduce((sum, probability) => sum + probability, 0);
      expect(total).toBeCloseTo(1, PRECISION);
    }
  });

  it('does not change the state', () => {
    const state = arbitraryState(2, 203);
    const before = state.clone();
    state.getMarginalProbabilities([1]);
    expectStatesEqual(state, before);
  });

  it.each([
    { qubits: [], reason: /at least one qubit/ },
    { qubits: [3], reason: /out of range/ },
    { qubits: [-1], reason: /out of range/ },
    { qubits: [0.5], reason: /out of range/ },
    { qubits: [0, 0], reason: /only once/ },
  ])('rejects the qubit list $qubits', ({ qubits, reason }) => {
    expect(() => QuantumState.basis(3, 0).getMarginalProbabilities(qubits)).toThrow(reason);
  });
});

describe('QuantumState.measureQubits', () => {
  it('measures one qubit of a product state and leaves the other exactly as it was', () => {
    for (let trial = 0; trial < 50; trial += 1) {
      const other = arbitraryState(1, 210 + trial);
      const state = tensorProduct(plusState(), other);

      const result = state.measureQubits([0]);
      expectStatesEqual(state, tensorProduct(QuantumState.basis(1, result), other));
    }
  });

  it('measures one half of a Bell pair and thereby fixes the other half', () => {
    for (let trial = 0; trial < 100; trial += 1) {
      const state = bellState();
      const first = state.measureQubits([0]);

      expectStatesEqual(state, QuantumState.basis(2, first === 0 ? 0b00 : 0b11));
      expect(state.measureQubits([1])).toBe(first);
    }
  });

  it('keeps the relative phase of the qubits it did not measure', () => {
    // (|0⟩|−⟩ + |1⟩|+⟩)/√2: the unmeasured qubit is left in |−⟩ or |+⟩ depending on the result.
    const entangled = (): QuantumState => QuantumState.fromAmplitudes([0.5, -0.5, 0.5, 0.5]);

    const gaveZero = entangled();
    expect(gaveZero.measureQubits([0], () => 0.1)).toBe(0);
    expectAmplitudes(gaveZero, [INVERSE_SQRT_2, -INVERSE_SQRT_2, 0, 0]);

    const gaveOne = entangled();
    expect(gaveOne.measureQubits([0], () => 0.9)).toBe(1);
    expectAmplitudes(gaveOne, [0, 0, INVERSE_SQRT_2, INVERSE_SQRT_2]);
  });

  it('leaves a normalised state, and repeating the measurement repeats the result', () => {
    const state = arbitraryState(3, 220);
    const result = state.measureQubits([0, 2]);

    expect(state.isNormalized()).toBe(true);
    for (let repeat = 0; repeat < 50; repeat += 1) {
      expect(state.measureQubits([0, 2])).toBe(result);
    }
  });

  it('indexes its result by the listed qubits, in the order listed', () => {
    expect(QuantumState.basis(3, 0b110).measureQubits([0, 2])).toBe(0b10);
    expect(QuantumState.basis(3, 0b110).measureQubits([2, 0])).toBe(0b01);
  });

  it('never returns a result the state rules out', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      expect([0b00, 0b11]).toContain(bellState().measureQubits([0, 1]));
    }
  });

  it('follows the marginal probabilities', () => {
    // Real randomness; the margin is over eight standard deviations wide.
    const shots = 20_000;
    const state = QuantumState.fromAmplitudes([Math.sqrt(0.1), Math.sqrt(0.2), Math.sqrt(0.3), Math.sqrt(0.4)]);

    let ones = 0;
    for (let shot = 0; shot < shots; shot += 1) {
      ones += state.clone().measureQubits([0]);
    }
    // Qubit 0 is 1 in |10⟩ and |11⟩: 0.3 + 0.4.
    expect(Math.abs(ones / shots - 0.7)).toBeLessThan(0.03);
  });

  it('maps an injected random number through the cumulative marginal probabilities', () => {
    // Three qubits in uniform superposition: the first two give 00, 01, 10, 11 with boundaries at 0.25, 0.5, 0.75.
    const uniform = (): QuantumState => QuantumState.basis(3, 0).applyHadamardAll();

    expect(uniform().measureQubits([0, 1], () => 0.1)).toBe(0);
    expect(uniform().measureQubits([0, 1], () => 0.3)).toBe(1);
    expect(uniform().measureQubits([0, 1], () => 0.6)).toBe(2);
    expect(uniform().measureQubits([0, 1], () => 0.9)).toBe(3);
  });

  it('refuses a state that is not normalised, and leaves it untouched', () => {
    const state = QuantumState.fromAmplitudes([1, 1, 1, 1]);
    expect(() => state.measureQubits([0])).toThrow(/not normalised/);
    expectAmplitudes(state, [1, 1, 1, 1]);
  });

  it('rejects an invalid qubit list', () => {
    const state = QuantumState.basis(2, 0);
    expect(() => state.measureQubits([])).toThrow(/at least one qubit/);
    expect(() => state.measureQubits([2])).toThrow(/out of range/);
    expect(() => state.measureQubits([1, 1])).toThrow(/only once/);
  });
});
