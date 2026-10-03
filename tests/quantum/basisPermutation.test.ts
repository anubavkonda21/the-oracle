import { describe, expect, it } from 'vitest';
import { ComplexNumber, Gates, QuantumState } from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';
import { PRECISION, arbitraryState, expectAmplitudes, expectStatesEqual } from './helpers';

const INVERSE_SQRT_2 = Math.SQRT1_2;

/** A reproducible random ordering of 0 … size−1, used as test data. */
function shuffledIndices(size: number, seed: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: size }, (_, index) => ({ index, key: random() }))
    .sort((first, second) => first.key - second.key)
    .map(({ index }) => index);
}

describe('QuantumState.applyBasisPermutation', () => {
  it('moves each amplitude to the basis state its own is sent to', () => {
    // |0⟩→|1⟩, |1⟩→|2⟩, |2⟩→|3⟩, |3⟩→|0⟩
    const state = QuantumState.fromAmplitudes([1, 2, 3, 4]).applyBasisPermutation((index) => (index + 1) % 4);
    expectAmplitudes(state, [4, 1, 2, 3]);
  });

  it('leaves the state alone for the identity permutation', () => {
    const original = arbitraryState(3, 101);
    expectStatesEqual(original.clone().applyBasisPermutation((index) => index), original);
  });

  it('carries complex amplitudes across intact, phase included', () => {
    const state = QuantumState.fromAmplitudes([new ComplexNumber(0, 1), new ComplexNumber(-0.5, 0.25)]);
    expectAmplitudes(state.applyBasisPermutation((index) => 1 - index), [[-0.5, 0.25], [0, 1]]);
  });

  it('reproduces the X gate: flipping one bit of every index is X on that qubit', () => {
    const qubitCount = 3;
    for (let qubit = 0; qubit < qubitCount; qubit += 1) {
      const bit = 1 << (qubitCount - 1 - qubit);
      const original = arbitraryState(qubitCount, 110 + qubit);

      const permuted = original.clone().applyBasisPermutation((index) => index ^ bit);
      expectStatesEqual(permuted, original.clone().applyGate(Gates.X, qubit));
    }
  });

  it('can express a two-qubit operation: a controlled-NOT turns (|00⟩ + |10⟩)/√2 into (|00⟩ + |11⟩)/√2', () => {
    // Flip qubit 1 (the right-hand bit) whenever qubit 0 (the left-hand bit) is 1.
    const controlledNot = (index: number): number => index ^ ((index >> 1) & 1);

    const state = QuantumState.basis(2, 0).applyGate(Gates.H, 0).applyBasisPermutation(controlledNot);
    expectAmplitudes(state, [INVERSE_SQRT_2, 0, 0, INVERSE_SQRT_2]);
  });

  it('preserves the norm, as every unitary operation must', () => {
    for (const seed of [121, 122, 123]) {
      const order = shuffledIndices(16, seed);
      const state = arbitraryState(4, seed).applyBasisPermutation((index) => order[index] ?? -1);
      expect(state.normSquared()).toBeCloseTo(1, PRECISION);
    }
  });

  it('is undone by the inverse permutation', () => {
    const order = shuffledIndices(8, 131);
    const inverse = new Array<number>(8).fill(0);
    order.forEach((target, source) => {
      inverse[target] = source;
    });

    const original = arbitraryState(3, 132);
    const roundTrip = original
      .clone()
      .applyBasisPermutation((index) => order[index] ?? -1)
      .applyBasisPermutation((index) => inverse[index] ?? -1);
    expectStatesEqual(roundTrip, original);
  });

  it('is linear: it acts on a superposition term by term', () => {
    const order = shuffledIndices(4, 141);
    const permute = (index: number): number => order[index] ?? -1;

    // Permuting a superposition must equal the same superposition of the permuted basis states.
    const amplitudes = arbitraryState(2, 142).getAmplitudes();
    const expected = new Array<ComplexNumber>(4).fill(ComplexNumber.zero);
    amplitudes.forEach((amplitude, index) => {
      expected[permute(index)] = amplitude;
    });

    expectStatesEqual(
      QuantumState.fromAmplitudes(amplitudes).applyBasisPermutation(permute),
      QuantumState.fromAmplitudes(expected),
    );
  });

  it('changes the state in place and returns it for chaining', () => {
    const state = QuantumState.basis(1, 0);
    expect(state.applyBasisPermutation((index) => 1 - index)).toBe(state);
    expectAmplitudes(state, [0, 1]);
  });

  it('rejects a mapping that sends two basis states to the same place', () => {
    const state = QuantumState.fromAmplitudes([0.5, 0.5, 0.5, 0.5]);
    expect(() => state.applyBasisPermutation(() => 0)).toThrow(/not reversible/);
    expectAmplitudes(state, [0.5, 0.5, 0.5, 0.5]);
  });

  it('rejects a mapping that leaves the basis', () => {
    const state = QuantumState.basis(2, 0);
    expect(() => state.applyBasisPermutation((index) => index + 1)).toThrow(/Not a permutation/);
    expect(() => state.applyBasisPermutation((index) => index - 1)).toThrow(/Not a permutation/);
    expect(() => state.applyBasisPermutation((index) => index + 0.5)).toThrow(/Not a permutation/);
    expectAmplitudes(state, [1, 0, 0, 0]);
  });
});
