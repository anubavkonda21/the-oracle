import { expect } from 'vitest';
import { ComplexNumber, QuantumState } from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';

/** Decimal places for `toBeCloseTo`: values must agree to within 5e-11, in line with QUANTUM_EPSILON. */
export const PRECISION = 10;

/** A real amplitude, or a [real, imaginary] pair. */
export type AmplitudeLike = number | readonly [real: number, imaginary: number];

export function expectComplex(actual: ComplexNumber, real: number, imaginary = 0): void {
  expect(actual.real).toBeCloseTo(real, PRECISION);
  expect(actual.imaginary).toBeCloseTo(imaginary, PRECISION);
}

/** Asserts the whole state vector, amplitude by amplitude, in basis-index order. */
export function expectAmplitudes(state: QuantumState, expected: readonly AmplitudeLike[]): void {
  expect(state.dimension).toBe(expected.length);
  expected.forEach((value, basisIndex) => {
    const [real, imaginary] = typeof value === 'number' ? [value, 0] : value;
    expectComplex(state.getAmplitude(basisIndex), real, imaginary);
  });
}

export function expectStatesEqual(actual: QuantumState, expected: QuantumState): void {
  expectAmplitudes(
    actual,
    expected.getAmplitudes().map((amplitude) => [amplitude.real, amplitude.imaginary] as const),
  );
}

/**
 * A normalised state with arbitrary complex amplitudes, for checking that a
 * property holds in general and not just for basis states. The seed makes the
 * test data reproducible; it plays no part in the engine's own randomness.
 */
export function arbitraryState(qubitCount: number, seed: number): QuantumState {
  const random = createSeededRandom(seed);
  const amplitudes = Array.from(
    { length: 2 ** qubitCount },
    () => new ComplexNumber(random() * 2 - 1, random() * 2 - 1),
  );
  return QuantumState.fromAmplitudes(amplitudes).normalize();
}
