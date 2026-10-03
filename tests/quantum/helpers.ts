import { expect } from 'vitest';
import { ComplexNumber, QuantumState, type Bit } from '../../src/quantum';
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

/** |ψ⟩ ⊗ |φ⟩, with |ψ⟩ on the lower-numbered (left-hand) qubits. */
export function tensorProduct(left: QuantumState, right: QuantumState): QuantumState {
  return QuantumState.fromAmplitudes(
    left
      .getAmplitudes()
      .flatMap((leftAmplitude) => right.getAmplitudes().map((rightAmplitude) => leftAmplitude.multiply(rightAmplitude))),
  );
}

/** The truth table whose outputs are the binary digits of `code`: output x is bit x of the number. */
export function truthTableFromCode(code: number, inputQubitCount: number): Bit[] {
  return Array.from({ length: 2 ** inputQubitCount }, (_, input) => ((code >> input) & 1) === 1 ? 1 : 0);
}

/** Every Boolean function of n bits, as truth tables: all 2^(2^n) of them. Practical for n ≤ 4. */
export function* allTruthTables(inputQubitCount: number): Generator<Bit[]> {
  const functionCount = 2 ** (2 ** inputQubitCount);
  for (let code = 0; code < functionCount; code += 1) {
    yield truthTableFromCode(code, inputQubitCount);
  }
}
