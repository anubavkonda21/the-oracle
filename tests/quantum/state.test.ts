import { describe, expect, it } from 'vitest';
import { ComplexNumber, MAX_QUBIT_COUNT, QUANTUM_EPSILON, QuantumState, basisStateLabel } from '../../src/quantum';
import { PRECISION, expectAmplitudes } from './helpers';

const INVERSE_SQRT_2 = Math.SQRT1_2;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('QuantumState.basis', () => {
  it.each([
    { label: '|0⟩', qubitCount: 1, basisIndex: 0, amplitudes: [1, 0] },
    { label: '|1⟩', qubitCount: 1, basisIndex: 1, amplitudes: [0, 1] },
    { label: '|00⟩', qubitCount: 2, basisIndex: 0, amplitudes: [1, 0, 0, 0] },
    { label: '|01⟩', qubitCount: 2, basisIndex: 1, amplitudes: [0, 1, 0, 0] },
    { label: '|10⟩', qubitCount: 2, basisIndex: 2, amplitudes: [0, 0, 1, 0] },
    { label: '|11⟩', qubitCount: 2, basisIndex: 3, amplitudes: [0, 0, 0, 1] },
  ])('creates $label', ({ qubitCount, basisIndex, amplitudes }) => {
    const state = QuantumState.basis(qubitCount, basisIndex);
    expect(state.qubitCount).toBe(qubitCount);
    expectAmplitudes(state, amplitudes);
  });

  it.each([1, 2, 3, 4, 5, 8])('holds 2^n amplitudes for %i qubit(s)', (qubitCount) => {
    const state = QuantumState.basis(qubitCount, 0);
    expect(state.dimension).toBe(2 ** qubitCount);
    expect(state.getAmplitudes()).toHaveLength(2 ** qubitCount);
  });

  it('is normalised, with all probability on the chosen basis state', () => {
    const state = QuantumState.basis(3, 5);
    expect(state.isNormalized()).toBe(true);
    expect(state.getProbabilities()).toEqual([0, 0, 0, 0, 0, 1, 0, 0]);
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_QUBIT_COUNT + 1])('rejects a qubit count of %s', (qubitCount) => {
    expect(() => QuantumState.basis(qubitCount, 0)).toThrow(/Qubit count/);
  });

  it.each([-1, 4, 1.5, Number.NaN])('rejects basis index %s for 2 qubits', (basisIndex) => {
    expect(() => QuantumState.basis(2, basisIndex)).toThrow(/out of range/);
  });
});

describe('QuantumState.fromAmplitudes', () => {
  it('keeps arbitrary complex amplitudes exactly as given', () => {
    const state = QuantumState.fromAmplitudes([
      new ComplexNumber(0.5, 0),
      new ComplexNumber(0, 0.5),
      new ComplexNumber(-0.5, 0),
      new ComplexNumber(0, -0.5),
    ]);
    expect(state.qubitCount).toBe(2);
    expectAmplitudes(state, [0.5, [0, 0.5], -0.5, [0, -0.5]]);
  });

  it('accepts plain numbers as real amplitudes', () => {
    expectAmplitudes(QuantumState.fromAmplitudes([0.6, 0.8]), [0.6, 0.8]);
  });

  it('infers the qubit count from the number of amplitudes', () => {
    expect(QuantumState.fromAmplitudes([1, 0]).qubitCount).toBe(1);
    expect(QuantumState.fromAmplitudes([1, 0, 0, 0]).qubitCount).toBe(2);
    expect(QuantumState.fromAmplitudes(new Array<number>(8).fill(0.5)).qubitCount).toBe(3);
  });

  it('does not normalise on its own', () => {
    const state = QuantumState.fromAmplitudes([1, 1]);
    expectAmplitudes(state, [1, 1]);
    expect(state.isNormalized()).toBe(false);
  });

  it('copies its input, so later changes to the array do not leak into the state', () => {
    const source = [1, 0];
    const state = QuantumState.fromAmplitudes(source);
    source[0] = 0;
    source[1] = 1;
    expectAmplitudes(state, [1, 0]);
  });

  it.each([0, 1, 3, 5, 6, 7, 12])('rejects %i amplitudes, which is not 2^n for n ≥ 1', (count) => {
    expect(() => QuantumState.fromAmplitudes(new Array<number>(count).fill(1))).toThrow(/2\^n amplitudes/);
  });

  it('rejects amplitudes that are not finite numbers', () => {
    expect(() => QuantumState.fromAmplitudes([1, Number.NaN])).toThrow(/not a finite number/);
    expect(() => QuantumState.fromAmplitudes([Number.POSITIVE_INFINITY, 0])).toThrow(/not a finite number/);
    expect(() => QuantumState.fromAmplitudes([new ComplexNumber(0, Number.NaN), 1])).toThrow(/not a finite number/);
  });
});

describe('QuantumState: reading amplitudes', () => {
  it('returns a copy of the vector, not the internal array', () => {
    const state = QuantumState.basis(1, 0);
    const amplitudes = state.getAmplitudes();
    amplitudes[0] = ComplexNumber.zero;
    expectAmplitudes(state, [1, 0]);
  });

  it('rejects an out-of-range basis index', () => {
    const state = QuantumState.basis(2, 0);
    expect(() => state.getAmplitude(4)).toThrow(/out of range/);
    expect(() => state.getAmplitude(-1)).toThrow(/out of range/);
  });
});

describe('QuantumState: normalisation', () => {
  it('normalises [1, 1] to [1/√2, 1/√2]', () => {
    const state = QuantumState.fromAmplitudes([1, 1]).normalize();
    expectAmplitudes(state, [INVERSE_SQRT_2, INVERSE_SQRT_2]);
    expect(state.isNormalized()).toBe(true);
  });

  it('normalises complex amplitudes', () => {
    // |3|² + |4i|² = 25, so the vector has length 5.
    const state = QuantumState.fromAmplitudes([3, new ComplexNumber(0, 4)]).normalize();
    expectAmplitudes(state, [0.6, [0, 0.8]]);
    expect(state.normSquared()).toBeCloseTo(1, PRECISION);
  });

  it('preserves relative phases', () => {
    const state = QuantumState.fromAmplitudes([1, new ComplexNumber(0, 1), -1, new ComplexNumber(0, -1)]).normalize();
    expectAmplitudes(state, [0.5, [0, 0.5], -0.5, [0, -0.5]]);
  });

  it('leaves an already normalised state unchanged', () => {
    const state = QuantumState.fromAmplitudes([0.6, 0.8]).normalize();
    expectAmplitudes(state, [0.6, 0.8]);
  });

  it('normalises in place and returns the same state for chaining', () => {
    const state = QuantumState.fromAmplitudes([2, 0]);
    expect(state.normalize()).toBe(state);
    expectAmplitudes(state, [1, 0]);
  });

  it('refuses to normalise a zero-norm vector, and never produces NaN', () => {
    const state = QuantumState.fromAmplitudes([0, 0, 0, 0]);
    expect(() => state.normalize()).toThrow(/Cannot normalise/);

    for (const amplitude of state.getAmplitudes()) {
      expect(Number.isNaN(amplitude.real)).toBe(false);
      expect(Number.isNaN(amplitude.imaginary)).toBe(false);
    }
    expectAmplitudes(state, [0, 0, 0, 0]);
  });

  it('treats a vector far below the numerical tolerance as zero-norm', () => {
    const state = QuantumState.fromAmplitudes([QUANTUM_EPSILON / 1000, 0]);
    expect(() => state.normalize()).toThrow(/Cannot normalise/);
  });
});

describe('QuantumState.isNormalized', () => {
  it('is true for basis states', () => {
    expect(QuantumState.basis(1, 1).isNormalized()).toBe(true);
    expect(QuantumState.basis(4, 9).isNormalized()).toBe(true);
  });

  it('is false until an unnormalised vector is normalised', () => {
    const state = QuantumState.fromAmplitudes([1, 1]);
    expect(state.isNormalized()).toBe(false);
    expect(state.normSquared()).toBeCloseTo(2, PRECISION);
    expect(state.normalize().isNormalized()).toBe(true);
  });

  it('is false for the zero vector', () => {
    expect(QuantumState.fromAmplitudes([0, 0]).isNormalized()).toBe(false);
  });

  it('absorbs floating-point error within the tolerance', () => {
    // 0.1 + 0.2 + 0.7 is not exactly 1 in floating point.
    const state = QuantumState.fromAmplitudes([Math.sqrt(0.1), Math.sqrt(0.2), Math.sqrt(0.7), 0]);
    expect(state.isNormalized()).toBe(true);
  });

  it('detects a real deviation, and honours a custom tolerance', () => {
    const slightlyLong = QuantumState.fromAmplitudes([1, 0.001]);
    expect(slightlyLong.isNormalized()).toBe(false);
    expect(slightlyLong.isNormalized(0.01)).toBe(true);
  });
});

describe('QuantumState.getProbabilities', () => {
  it('is |amplitude|² for each basis state', () => {
    const state = QuantumState.fromAmplitudes([0.6, new ComplexNumber(0, 0.8)]);
    const probabilities = state.getProbabilities();
    expect(probabilities[0]).toBeCloseTo(0.36, PRECISION);
    expect(probabilities[1]).toBeCloseTo(0.64, PRECISION);
  });

  it('sums to 1 for a normalised state', () => {
    const state = QuantumState.fromAmplitudes([1, new ComplexNumber(2, -1), new ComplexNumber(0, 3), -4]).normalize();
    expect(sum(state.getProbabilities())).toBeCloseTo(1, PRECISION);
  });

  it('reports the raw |amplitude|² of an unnormalised vector rather than inventing a distribution', () => {
    expect(QuantumState.fromAmplitudes([1, 1]).getProbabilities()).toEqual([1, 1]);
  });

  it('does not see relative phase: two different states can share the same probabilities', () => {
    const plus = QuantumState.fromAmplitudes([INVERSE_SQRT_2, INVERSE_SQRT_2]);
    const minus = QuantumState.fromAmplitudes([INVERSE_SQRT_2, -INVERSE_SQRT_2]);

    expect(plus.getProbabilities()).toEqual(minus.getProbabilities());
    expect(plus.equals(minus)).toBe(false);
  });
});

describe('QuantumState: clone and equals', () => {
  it('clones into an independent state', () => {
    const original = QuantumState.fromAmplitudes([3, 4]);
    const copy = original.clone();
    copy.normalize();

    expectAmplitudes(original, [3, 4]);
    expectAmplitudes(copy, [0.6, 0.8]);
  });

  it('compares amplitude by amplitude, within tolerance', () => {
    const state = QuantumState.fromAmplitudes([0.6, 0.8]);
    expect(state.equals(QuantumState.fromAmplitudes([0.6, 0.8 + QUANTUM_EPSILON / 10]))).toBe(true);
    expect(state.equals(QuantumState.fromAmplitudes([0.8, 0.6]))).toBe(false);
  });

  it('never equates states of different sizes', () => {
    expect(QuantumState.basis(1, 0).equals(QuantumState.basis(2, 0))).toBe(false);
  });
});

describe('basisStateLabel', () => {
  it('labels two-qubit basis states', () => {
    expect([0, 1, 2, 3].map((index) => basisStateLabel(index, 2))).toEqual(['00', '01', '10', '11']);
  });

  it('labels three-qubit basis states from 000 to 111', () => {
    expect(Array.from({ length: 8 }, (_, index) => basisStateLabel(index, 3))).toEqual([
      '000',
      '001',
      '010',
      '011',
      '100',
      '101',
      '110',
      '111',
    ]);
  });

  it('labels single-qubit and wider states', () => {
    expect(basisStateLabel(0, 1)).toBe('0');
    expect(basisStateLabel(1, 1)).toBe('1');
    expect(basisStateLabel(13, 5)).toBe('01101');
  });

  it('reads back as the basis index in binary', () => {
    for (let index = 0; index < 16; index += 1) {
      expect(Number.parseInt(basisStateLabel(index, 4), 2)).toBe(index);
    }
  });

  it('rejects an index that does not fit the qubit count', () => {
    expect(() => basisStateLabel(4, 2)).toThrow(/out of range/);
    expect(() => basisStateLabel(-1, 2)).toThrow(/out of range/);
    expect(() => basisStateLabel(0, 0)).toThrow(/Qubit count/);
  });
});
