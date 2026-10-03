import { ComplexNumber, QUANTUM_EPSILON } from './complex';
import { Gates, applyGateToPair, type Gate } from './gates';
import { probabilitiesOf, sampleIndex, type RandomSource } from './measurement';

/*
 * QUBIT-ORDER CONVENTION — used by the whole engine, and to be kept by every
 * future module built on it (the Oracle, Deutsch–Jozsa, visualisations).
 *
 *   Qubit 0 is the LEFTMOST character of a basis label, and therefore the
 *   MOST significant bit of the basis index.
 *
 * A basis index is simply its label read as a binary number:
 *
 *   2 qubits:  0 → |00⟩   1 → |01⟩   2 → |10⟩   3 → |11⟩
 *   3 qubits:  5 → |101⟩  means qubit 0 = 1, qubit 1 = 0, qubit 2 = 1
 *
 * So the character at position q of a label is the value of qubit q — the
 * same left-to-right order in which a bit string is read and typed.
 */

/** Largest register the engine will allocate: 2^16 = 65,536 amplitudes. The game only needs a handful of qubits. */
export const MAX_QUBIT_COUNT = 16;

function assertQubitCount(qubitCount: number): void {
  if (!Number.isInteger(qubitCount) || qubitCount < 1 || qubitCount > MAX_QUBIT_COUNT) {
    throw new RangeError(`Qubit count must be a whole number from 1 to ${MAX_QUBIT_COUNT}; received ${qubitCount}.`);
  }
}

function assertBasisIndex(basisIndex: number, qubitCount: number): void {
  const dimension = 2 ** qubitCount;
  if (!Number.isInteger(basisIndex) || basisIndex < 0 || basisIndex >= dimension) {
    throw new RangeError(
      `Basis index ${basisIndex} is out of range for ${qubitCount} qubit(s): expected 0 to ${dimension - 1}.`,
    );
  }
}

/** The label of a computational basis state, e.g. index 2 of 2 qubits → "10". Qubit 0 is the leftmost character. */
export function basisStateLabel(basisIndex: number, qubitCount: number): string {
  assertQubitCount(qubitCount);
  assertBasisIndex(basisIndex, qubitCount);
  return basisIndex.toString(2).padStart(qubitCount, '0');
}

function basisAmplitudes(dimension: number, basisIndex: number): ComplexNumber[] {
  const amplitudes = new Array<ComplexNumber>(dimension).fill(ComplexNumber.zero);
  amplitudes[basisIndex] = ComplexNumber.one;
  return amplitudes;
}

/**
 * The pure state of an n-qubit register: 2^n complex amplitudes, one per
 * computational basis state. For one qubit, [a, b] means a|0⟩ + b|1⟩.
 *
 * The amplitudes are the whole description of the state. Probabilities are
 * derived from them (|amplitude|²), but amplitudes carry more than
 * probabilities do: they have signs and phases, and can cancel one another.
 * That is why a superposition is not the same thing as a classical "it is 0
 * or 1 and we don't know which".
 *
 * A QuantumState is mutable: gates and measurement change it in place, as
 * they change a physical register. Use `clone()` to keep an earlier copy.
 */
export class QuantumState {
  private constructor(
    readonly qubitCount: number,
    private amplitudes: ComplexNumber[],
  ) {}

  /** The computational basis state with the given index, e.g. `basis(2, 2)` is |10⟩. */
  static basis(qubitCount: number, basisIndex: number): QuantumState {
    assertQubitCount(qubitCount);
    assertBasisIndex(basisIndex, qubitCount);
    return new QuantumState(qubitCount, basisAmplitudes(2 ** qubitCount, basisIndex));
  }

  /**
   * A state with exactly these amplitudes, in basis-index order. Plain numbers
   * are taken as real amplitudes. The qubit count is inferred from the length,
   * which must be 2^n. The amplitudes are NOT normalised for you: build any
   * vector, then call `normalize()`.
   */
  static fromAmplitudes(amplitudes: readonly (ComplexNumber | number)[]): QuantumState {
    const dimension = amplitudes.length;
    const isPowerOfTwo = dimension >= 2 && (dimension & (dimension - 1)) === 0;
    if (!isPowerOfTwo) {
      throw new RangeError(
        `A state vector needs exactly 2^n amplitudes for n ≥ 1 qubits (2, 4, 8, …); received ${dimension}.`,
      );
    }
    const qubitCount = 31 - Math.clz32(dimension);
    assertQubitCount(qubitCount);

    const converted = amplitudes.map((amplitude, basisIndex) => {
      const complex = typeof amplitude === 'number' ? ComplexNumber.fromReal(amplitude) : amplitude;
      if (!Number.isFinite(complex.real) || !Number.isFinite(complex.imaginary)) {
        throw new RangeError(`Amplitude ${basisIndex} is not a finite number.`);
      }
      return complex;
    });
    return new QuantumState(qubitCount, converted);
  }

  /** Number of amplitudes: 2^n. */
  get dimension(): number {
    return this.amplitudes.length;
  }

  getAmplitude(basisIndex: number): ComplexNumber {
    assertBasisIndex(basisIndex, this.qubitCount);
    return this.amplitudeAt(basisIndex);
  }

  /** A copy of the state vector, in basis-index order. */
  getAmplitudes(): ComplexNumber[] {
    return [...this.amplitudes];
  }

  /**
   * P(i) = |αᵢ|² for every basis state, computed directly from the current
   * amplitudes. They sum to 1 exactly when the state is normalised.
   */
  getProbabilities(): number[] {
    return probabilitiesOf(this.amplitudes);
  }

  /**
   * The probabilities of each result of measuring ONLY the listed qubits,
   * whatever the other qubits would give: each basis state's |αᵢ|² is added to
   * the result it is consistent with.
   *
   * A result is indexed by reading the listed qubits, in the order listed, as
   * a binary number — so `basisStateLabel(result, qubits.length)` is its label.
   */
  getMarginalProbabilities(qubits: readonly number[]): number[] {
    this.assertQubitList(qubits);

    const probabilities = new Array<number>(2 ** qubits.length).fill(0);
    this.amplitudes.forEach((amplitude, basisIndex) => {
      const result = this.readQubits(basisIndex, qubits);
      probabilities[result] = (probabilities[result] ?? 0) + amplitude.magnitudeSquared();
    });
    return probabilities;
  }

  /** Σ |αᵢ|² — the squared length of the state vector. */
  normSquared(): number {
    let sum = 0;
    for (const amplitude of this.amplitudes) {
      sum += amplitude.magnitudeSquared();
    }
    return sum;
  }

  /** True when Σ |αᵢ|² = 1 to within `tolerance`. */
  isNormalized(tolerance = QUANTUM_EPSILON): boolean {
    return Math.abs(this.normSquared() - 1) <= tolerance;
  }

  /**
   * Rescales the vector to unit length. Every amplitude is divided by the
   * same positive real number, so the ratios between amplitudes — and with
   * them all relative phases — are unchanged.
   */
  normalize(): this {
    const norm = Math.sqrt(this.normSquared());
    if (!(norm > QUANTUM_EPSILON) || !Number.isFinite(norm)) {
      throw new RangeError(
        `Cannot normalise a vector of length ${norm}: only a non-zero, finite vector describes a quantum state.`,
      );
    }
    this.amplitudes = this.amplitudes.map((amplitude) => amplitude.scale(1 / norm));
    return this;
  }

  /**
   * Applies a single-qubit gate to one qubit of the register.
   *
   * The basis states pair up: two states belong together when they agree on
   * every qubit except the target. The gate's 2 × 2 matrix is applied to the
   * two amplitudes of each pair, and no other amplitudes are mixed. This is
   * exactly multiplication by I ⊗ … ⊗ gate ⊗ … ⊗ I, without building the
   * full 2^n × 2^n matrix.
   */
  applyGate(gate: Gate, targetQubit: number): this {
    if (!Number.isInteger(targetQubit) || targetQubit < 0 || targetQubit >= this.qubitCount) {
      throw new RangeError(
        `Target qubit ${targetQubit} is out of range for a ${this.qubitCount}-qubit state: expected 0 to ${this.qubitCount - 1}.`,
      );
    }

    // Qubit 0 is the most significant bit of the index, so the target's bit is counted from the right.
    const targetBit = 1 << (this.qubitCount - 1 - targetQubit);

    for (let index0 = 0; index0 < this.dimension; index0 += 1) {
      if ((index0 & targetBit) !== 0) {
        continue; // Each pair is handled once, from the member whose target qubit is 0.
      }
      const index1 = index0 | targetBit;
      const [next0, next1] = applyGateToPair(gate, this.amplitudeAt(index0), this.amplitudeAt(index1));
      this.amplitudes[index0] = next0;
      this.amplitudes[index1] = next1;
    }
    return this;
  }

  /** Applies a Hadamard gate to every qubit. On |0…0⟩ this gives the uniform superposition 1/√(2^n) Σₓ |x⟩. */
  applyHadamardAll(): this {
    for (let qubit = 0; qubit < this.qubitCount; qubit += 1) {
      this.applyGate(Gates.H, qubit);
    }
    return this;
  }

  /**
   * Applies a permutation of the computational basis: every basis state |i⟩
   * is sent to |π(i)⟩, so the amplitude of i moves to π(i). This is how an
   * operation spanning several qubits is expressed when it only relabels
   * basis states — a reversible classical computation such as an oracle.
   *
   * Such an operation is unitary exactly when π is one-to-one, so anything
   * else is rejected: two basis states sent to the same place would destroy
   * amplitude, which no quantum operation can do.
   */
  applyBasisPermutation(permutation: (basisIndex: number) => number): this {
    const next = new Array<ComplexNumber>(this.dimension).fill(ComplexNumber.zero);
    const taken = new Array<boolean>(this.dimension).fill(false);

    for (let source = 0; source < this.dimension; source += 1) {
      const target = permutation(source);
      if (!Number.isInteger(target) || target < 0 || target >= this.dimension) {
        throw new RangeError(
          `Not a permutation of the basis: state ${source} is sent to ${target}, outside 0 to ${this.dimension - 1}.`,
        );
      }
      if (taken[target]) {
        throw new RangeError(
          `Not a permutation of the basis: more than one state is sent to ${target}, so the operation is not reversible.`,
        );
      }
      taken[target] = true;
      next[target] = this.amplitudeAt(source);
    }

    this.amplitudes = next;
    return this;
  }

  /**
   * NON-DESTRUCTIVE. Draws a basis index with the probabilities a measurement
   * would have, and leaves the state exactly as it was. A real register cannot
   * be sampled without disturbing it; a simulator can, which is useful for
   * showing what a measurement would be likely to give.
   */
  sampleMeasurement(random: RandomSource = Math.random): number {
    this.assertNormalized();
    return sampleIndex(this.getProbabilities(), random);
  }

  /**
   * DESTRUCTIVE. Measures every qubit in the computational basis: draws a
   * basis index with probability |αᵢ|², then collapses the state onto that
   * basis state, so measuring again is certain to give the same result.
   *
   * The collapsed state is stored as exactly |i⟩. Strictly it keeps the phase
   * of αᵢ, but that is a global phase and cannot affect any later outcome.
   */
  measure(random: RandomSource = Math.random): number {
    const outcome = this.sampleMeasurement(random);
    this.amplitudes = basisAmplitudes(this.dimension, outcome);
    return outcome;
  }

  /**
   * DESTRUCTIVE. Measures only the listed qubits and leaves the rest
   * unmeasured. The result is drawn from `getMarginalProbabilities(qubits)`
   * and indexed the same way.
   *
   * The state collapses onto the part consistent with the result: every
   * amplitude that disagrees with it becomes 0, and the survivors are
   * rescaled to unit length. Their ratios and relative phases are untouched,
   * so the unmeasured qubits keep whatever superposition is left to them.
   */
  measureQubits(qubits: readonly number[], random: RandomSource = Math.random): number {
    this.assertNormalized();
    const probabilities = this.getMarginalProbabilities(qubits);
    const result = sampleIndex(probabilities, random);

    // The sampler never returns a result of probability 0, so this division is safe.
    const rescale = 1 / Math.sqrt(probabilities[result] ?? 1);
    this.amplitudes = this.amplitudes.map((amplitude, basisIndex) =>
      this.readQubits(basisIndex, qubits) === result ? amplitude.scale(rescale) : ComplexNumber.zero,
    );
    return result;
  }

  /** An independent copy: changing one state does not affect the other. */
  clone(): QuantumState {
    return new QuantumState(this.qubitCount, [...this.amplitudes]);
  }

  /** True when every amplitude agrees to within `tolerance`. A global phase is NOT ignored. */
  equals(other: QuantumState, tolerance = QUANTUM_EPSILON): boolean {
    return (
      this.qubitCount === other.qubitCount &&
      this.amplitudes.every((amplitude, basisIndex) => amplitude.equals(other.amplitudeAt(basisIndex), tolerance))
    );
  }

  private amplitudeAt(basisIndex: number): ComplexNumber {
    const amplitude = this.amplitudes[basisIndex];
    if (amplitude === undefined) {
      throw new RangeError(`No amplitude at basis index ${basisIndex}.`);
    }
    return amplitude;
  }

  private assertNormalized(): void {
    if (!this.isNormalized()) {
      throw new RangeError(
        `Cannot measure a state that is not normalised (Σ|α|² = ${this.normSquared()}). Call normalize() first.`,
      );
    }
  }

  private assertQubitList(qubits: readonly number[]): void {
    if (qubits.length === 0) {
      throw new RangeError('Expected at least one qubit.');
    }
    for (const qubit of qubits) {
      if (!Number.isInteger(qubit) || qubit < 0 || qubit >= this.qubitCount) {
        throw new RangeError(
          `Qubit ${qubit} is out of range for a ${this.qubitCount}-qubit state: expected 0 to ${this.qubitCount - 1}.`,
        );
      }
    }
    if (new Set(qubits).size !== qubits.length) {
      throw new RangeError(`Each qubit may be listed only once; received [${qubits.join(', ')}].`);
    }
  }

  /** The values of the listed qubits within one basis state, read in the order listed as a binary number. */
  private readQubits(basisIndex: number, qubits: readonly number[]): number {
    let value = 0;
    for (const qubit of qubits) {
      // Qubit 0 is the most significant bit of the index, so each qubit's bit is counted from the right.
      const bit = (basisIndex >> (this.qubitCount - 1 - qubit)) & 1;
      value = (value << 1) | bit;
    }
    return value;
  }
}
