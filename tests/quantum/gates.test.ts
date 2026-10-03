import { describe, expect, it } from 'vitest';
import { ComplexNumber, Gates, QuantumState, basisStateLabel, type Gate } from '../../src/quantum';
import { PRECISION, arbitraryState, expectAmplitudes, expectComplex, expectStatesEqual } from './helpers';

const INVERSE_SQRT_2 = Math.SQRT1_2;
const ALL_GATES: readonly Gate[] = [Gates.I, Gates.X, Gates.Z, Gates.H];

type Matrix = ComplexNumber[][];

/** Kronecker (tensor) product of two matrices. */
function kron(left: Matrix, right: Matrix): Matrix {
  return left.flatMap((leftRow) =>
    right.map((rightRow) => leftRow.flatMap((leftEntry) => rightRow.map((rightEntry) => leftEntry.multiply(rightEntry)))),
  );
}

/**
 * The full 2^n × 2^n operator for a gate on one qubit: I ⊗ … ⊗ gate ⊗ … ⊗ I,
 * with qubit 0 as the leftmost factor. Built the slow, obvious way, as an
 * independent reference to check the engine's pairwise shortcut against.
 */
function fullOperator(gate: Gate, targetQubit: number, qubitCount: number): Matrix {
  const factors = Array.from({ length: qubitCount }, (_, qubit): Matrix =>
    (qubit === targetQubit ? gate : Gates.I).matrix.map((row) => [...row]),
  );
  return factors.reduce(kron);
}

function applyMatrix(matrix: Matrix, vector: readonly ComplexNumber[]): ComplexNumber[] {
  return matrix.map((row) => {
    expect(row).toHaveLength(vector.length);
    return row.reduce(
      (sum, entry, column) => sum.add(entry.multiply(vector[column] ?? ComplexNumber.zero)),
      ComplexNumber.zero,
    );
  });
}

/** 1 when x and y share an odd number of set bits, otherwise 0. */
function bitwiseDotProduct(x: number, y: number): number {
  let shared = x & y;
  let parity = 0;
  while (shared !== 0) {
    parity ^= shared & 1;
    shared >>= 1;
  }
  return parity;
}

describe('Gates: matrices', () => {
  it.each([
    { gate: Gates.I, rows: [[1, 0], [0, 1]] },
    { gate: Gates.X, rows: [[0, 1], [1, 0]] },
    { gate: Gates.Z, rows: [[1, 0], [0, -1]] },
    { gate: Gates.H, rows: [[INVERSE_SQRT_2, INVERSE_SQRT_2], [INVERSE_SQRT_2, -INVERSE_SQRT_2]] },
  ])('$gate.name has the textbook matrix', ({ gate, rows }) => {
    const actual = gate.matrix.flat().map((entry) => [entry.real, entry.imaginary]);
    const expected = rows.flat().map((value) => [value, 0]);
    expect(actual).toEqual(expected);
  });

  it.each(ALL_GATES)('$name is unitary: U†U = I', (gate) => {
    const [[a, b], [c, d]] = gate.matrix;
    expectComplex(a.conjugate().multiply(a).add(c.conjugate().multiply(c)), 1, 0);
    expectComplex(a.conjugate().multiply(b).add(c.conjugate().multiply(d)), 0, 0);
    expectComplex(b.conjugate().multiply(a).add(d.conjugate().multiply(c)), 0, 0);
    expectComplex(b.conjugate().multiply(b).add(d.conjugate().multiply(d)), 1, 0);
  });

  it('cannot be modified, since every state shares the same gate objects', () => {
    for (const gate of ALL_GATES) {
      expect(Object.isFrozen(gate)).toBe(true);
      expect(Object.isFrozen(gate.matrix)).toBe(true);
      expect(gate.matrix.every((row) => Object.isFrozen(row))).toBe(true);
    }
  });
});

describe('Gates: action on one qubit', () => {
  it('X|0⟩ = |1⟩', () => {
    expectAmplitudes(QuantumState.basis(1, 0).applyGate(Gates.X, 0), [0, 1]);
  });

  it('X|1⟩ = |0⟩', () => {
    expectAmplitudes(QuantumState.basis(1, 1).applyGate(Gates.X, 0), [1, 0]);
  });

  it('Z|0⟩ = |0⟩', () => {
    expectAmplitudes(QuantumState.basis(1, 0).applyGate(Gates.Z, 0), [1, 0]);
  });

  it('Z|1⟩ = −|1⟩', () => {
    expectAmplitudes(QuantumState.basis(1, 1).applyGate(Gates.Z, 0), [0, -1]);
  });

  it('H|0⟩ = (|0⟩ + |1⟩)/√2', () => {
    expectAmplitudes(QuantumState.basis(1, 0).applyGate(Gates.H, 0), [INVERSE_SQRT_2, INVERSE_SQRT_2]);
  });

  it('H|1⟩ = (|0⟩ − |1⟩)/√2', () => {
    expectAmplitudes(QuantumState.basis(1, 1).applyGate(Gates.H, 0), [INVERSE_SQRT_2, -INVERSE_SQRT_2]);
  });

  it('I leaves any state as it was', () => {
    const state = arbitraryState(1, 11);
    expectStatesEqual(state.clone().applyGate(Gates.I, 0), state);
  });

  it('X swaps the two amplitudes of a general state', () => {
    const state = QuantumState.fromAmplitudes([new ComplexNumber(0.6, 0), new ComplexNumber(0, 0.8)]);
    expectAmplitudes(state.applyGate(Gates.X, 0), [[0, 0.8], 0.6]);
  });

  it('Z changes the relative phase but none of the probabilities', () => {
    const state = QuantumState.fromAmplitudes([0.6, 0.8]);
    const before = state.getProbabilities();
    state.applyGate(Gates.Z, 0);

    expectAmplitudes(state, [0.6, -0.8]);
    expect(state.getProbabilities()).toEqual(before);
  });

  it('changes the state in place and returns it for chaining', () => {
    const state = QuantumState.basis(1, 0);
    expect(state.applyGate(Gates.X, 0)).toBe(state);
    expectAmplitudes(state.applyGate(Gates.X, 0).applyGate(Gates.H, 0), [INVERSE_SQRT_2, INVERSE_SQRT_2]);
  });
});

describe('Gates: algebra', () => {
  it.each(ALL_GATES)('$name applied twice is the identity: G(G|ψ⟩) = |ψ⟩', (gate) => {
    const original = arbitraryState(1, 21);
    expectStatesEqual(original.clone().applyGate(gate, 0).applyGate(gate, 0), original);
  });

  it('H(H|ψ⟩) = |ψ⟩ on every qubit of a multi-qubit state', () => {
    const original = arbitraryState(3, 22);
    for (let qubit = 0; qubit < 3; qubit += 1) {
      expectStatesEqual(original.clone().applyGate(Gates.H, qubit).applyGate(Gates.H, qubit), original);
    }
  });

  it('HZH = X: a phase flip, seen through Hadamards, is a bit flip', () => {
    const state = arbitraryState(1, 23);
    const viaHadamards = state.clone().applyGate(Gates.H, 0).applyGate(Gates.Z, 0).applyGate(Gates.H, 0);
    expectStatesEqual(viaHadamards, state.clone().applyGate(Gates.X, 0));
  });

  it('HXH = Z', () => {
    const state = arbitraryState(1, 24);
    const viaHadamards = state.clone().applyGate(Gates.H, 0).applyGate(Gates.X, 0).applyGate(Gates.H, 0);
    expectStatesEqual(viaHadamards, state.clone().applyGate(Gates.Z, 0));
  });

  it('X and Z anticommute: XZ|ψ⟩ = −ZX|ψ⟩', () => {
    const state = arbitraryState(1, 25);
    const zThenX = state.clone().applyGate(Gates.Z, 0).applyGate(Gates.X, 0);
    const xThenZ = state.clone().applyGate(Gates.X, 0).applyGate(Gates.Z, 0);

    const negated = QuantumState.fromAmplitudes(xThenZ.getAmplitudes().map((amplitude) => amplitude.scale(-1)));
    expectStatesEqual(zThenX, negated);
  });

  it.each(ALL_GATES)('$name is linear: G(a|ψ⟩ + b|φ⟩) = a·G|ψ⟩ + b·G|φ⟩', (gate) => {
    const psi = arbitraryState(2, 31);
    const phi = arbitraryState(2, 32);
    const a = new ComplexNumber(0.3, -0.7);
    const b = new ComplexNumber(-1.1, 0.4);

    const combine = (first: QuantumState, second: QuantumState): QuantumState =>
      QuantumState.fromAmplitudes(
        first.getAmplitudes().map((amplitude, index) => a.multiply(amplitude).add(b.multiply(second.getAmplitude(index)))),
      );

    const gateOfCombination = combine(psi, phi).applyGate(gate, 1);
    const combinationOfGates = combine(psi.clone().applyGate(gate, 1), phi.clone().applyGate(gate, 1));
    expectStatesEqual(gateOfCombination, combinationOfGates);
  });

  it.each(ALL_GATES)('$name preserves the norm on every qubit', (gate) => {
    for (let qubit = 0; qubit < 3; qubit += 1) {
      const state = arbitraryState(3, 40 + qubit).applyGate(gate, qubit);
      expect(state.normSquared()).toBeCloseTo(1, PRECISION);
    }
  });
});

describe('Gates: one qubit of a multi-qubit state', () => {
  it('X on qubit 0 of |00⟩ gives |10⟩', () => {
    expectAmplitudes(QuantumState.basis(2, 0).applyGate(Gates.X, 0), [0, 0, 1, 0]);
  });

  it('X on qubit 1 of |00⟩ gives |01⟩', () => {
    expectAmplitudes(QuantumState.basis(2, 0).applyGate(Gates.X, 1), [0, 1, 0, 0]);
  });

  it('flips exactly the character of the label that matches the qubit number', () => {
    for (let qubit = 0; qubit < 4; qubit += 1) {
      const state = QuantumState.basis(4, 0).applyGate(Gates.X, qubit);
      const outcome = state.getProbabilities().indexOf(1);

      const expectedLabel = '0000'.slice(0, qubit) + '1' + '0000'.slice(qubit + 1);
      expect(basisStateLabel(outcome, 4)).toBe(expectedLabel);
    }
  });

  it('H on qubit 0 of |00⟩ gives (|00⟩ + |10⟩)/√2', () => {
    expectAmplitudes(QuantumState.basis(2, 0).applyGate(Gates.H, 0), [INVERSE_SQRT_2, 0, INVERSE_SQRT_2, 0]);
  });

  it('H on qubit 1 of |00⟩ gives (|00⟩ + |01⟩)/√2', () => {
    expectAmplitudes(QuantumState.basis(2, 0).applyGate(Gates.H, 1), [INVERSE_SQRT_2, INVERSE_SQRT_2, 0, 0]);
  });

  it('Z on one qubit negates only the amplitudes where that qubit is 1', () => {
    const amplitudes = [0.1, 0.2, 0.3, 0.4];

    // Qubit 1 is the right-hand character: it is 1 in |01⟩ and |11⟩.
    expectAmplitudes(QuantumState.fromAmplitudes(amplitudes).applyGate(Gates.Z, 1), [0.1, -0.2, 0.3, -0.4]);
    // Qubit 0 is the left-hand character: it is 1 in |10⟩ and |11⟩.
    expectAmplitudes(QuantumState.fromAmplitudes(amplitudes).applyGate(Gates.Z, 0), [0.1, 0.2, -0.3, -0.4]);
  });

  it('X on the middle qubit exchanges only the pairs that differ in that qubit', () => {
    const state = QuantumState.fromAmplitudes([1, 2, 3, 4, 5, 6, 7, 8]).applyGate(Gates.X, 1);
    // |000⟩↔|010⟩, |001⟩↔|011⟩, |100⟩↔|110⟩, |101⟩↔|111⟩
    expectAmplitudes(state, [3, 4, 1, 2, 7, 8, 5, 6]);
  });

  it('acts on a product state one factor at a time: G on qubit 0 of |ψ⟩⊗|φ⟩ is (G|ψ⟩)⊗|φ⟩', () => {
    const psi = arbitraryState(1, 51);
    const phi = arbitraryState(1, 52);
    const product = (left: QuantumState, right: QuantumState): QuantumState =>
      QuantumState.fromAmplitudes(
        left.getAmplitudes().flatMap((leftAmplitude) => right.getAmplitudes().map((rightAmplitude) => leftAmplitude.multiply(rightAmplitude))),
      );

    for (const gate of ALL_GATES) {
      expectStatesEqual(product(psi, phi).applyGate(gate, 0), product(psi.clone().applyGate(gate, 0), phi));
      expectStatesEqual(product(psi, phi).applyGate(gate, 1), product(psi, phi.clone().applyGate(gate, 0)));
    }
  });

  it.each([
    { qubitCount: 2, seed: 61 },
    { qubitCount: 3, seed: 62 },
    { qubitCount: 4, seed: 63 },
  ])('matches the full I ⊗ … ⊗ G ⊗ … ⊗ I matrix on $qubitCount qubits', ({ qubitCount, seed }) => {
    for (const gate of ALL_GATES) {
      for (let target = 0; target < qubitCount; target += 1) {
        const state = arbitraryState(qubitCount, seed);
        const expected = applyMatrix(fullOperator(gate, target, qubitCount), state.getAmplitudes());

        state.applyGate(gate, target);
        expectStatesEqual(state, QuantumState.fromAmplitudes(expected));
      }
    }
  });

  it('commutes when gates act on different qubits', () => {
    const original = arbitraryState(3, 71);
    const hThenX = original.clone().applyGate(Gates.H, 0).applyGate(Gates.X, 2);
    const xThenH = original.clone().applyGate(Gates.X, 2).applyGate(Gates.H, 0);
    expectStatesEqual(hThenX, xThenH);
  });

  it.each([-1, 2, 0.5, Number.NaN])('rejects target qubit %s on a 2-qubit state and leaves the state untouched', (target) => {
    const state = QuantumState.basis(2, 1);
    expect(() => state.applyGate(Gates.X, target)).toThrow(/Target qubit/);
    expectAmplitudes(state, [0, 1, 0, 0]);
  });
});

describe('Hadamard', () => {
  it('turns |0⟩ into an equal superposition', () => {
    const state = QuantumState.basis(1, 0).applyGate(Gates.H, 0);
    expectAmplitudes(state, [INVERSE_SQRT_2, INVERSE_SQRT_2]);

    const [p0, p1] = state.getProbabilities();
    expect(p0).toBeCloseTo(0.5, PRECISION);
    expect(p1).toBeCloseTo(0.5, PRECISION);
  });

  it('turns |1⟩ into equal magnitudes with a negative relative phase', () => {
    const state = QuantumState.basis(1, 1).applyGate(Gates.H, 0);
    expectAmplitudes(state, [INVERSE_SQRT_2, -INVERSE_SQRT_2]);

    const [p0, p1] = state.getProbabilities();
    expect(p0).toBeCloseTo(0.5, PRECISION);
    expect(p1).toBeCloseTo(0.5, PRECISION);
  });

  it('gives H|0⟩ and H|1⟩ the same probabilities but different states', () => {
    const fromZero = QuantumState.basis(1, 0).applyGate(Gates.H, 0);
    const fromOne = QuantumState.basis(1, 1).applyGate(Gates.H, 0);

    expect(fromZero.equals(fromOne)).toBe(false);
    // The difference is real: a second Hadamard sends them back to |0⟩ and |1⟩ respectively.
    expectAmplitudes(fromZero.applyGate(Gates.H, 0), [1, 0]);
    expectAmplitudes(fromOne.applyGate(Gates.H, 0), [0, 1]);
  });

  it('on all qubits of |00⟩ gives four equal amplitudes of 1/2', () => {
    const state = QuantumState.basis(2, 0).applyHadamardAll();
    expectAmplitudes(state, [0.5, 0.5, 0.5, 0.5]);
    for (const probability of state.getProbabilities()) {
      expect(probability).toBeCloseTo(0.25, PRECISION);
    }
  });

  it('on all qubits of |000⟩ gives eight equal amplitudes of 1/√8', () => {
    const state = QuantumState.basis(3, 0).applyHadamardAll();
    expectAmplitudes(state, new Array<number>(8).fill(1 / Math.sqrt(8)));
    for (const probability of state.getProbabilities()) {
      expect(probability).toBeCloseTo(1 / 8, PRECISION);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('on all %i qubit(s) of |0…0⟩ gives the uniform superposition 1/√(2^n) Σ|x⟩', (qubitCount) => {
    const dimension = 2 ** qubitCount;
    const state = QuantumState.basis(qubitCount, 0).applyHadamardAll();

    expectAmplitudes(state, new Array<number>(dimension).fill(1 / Math.sqrt(dimension)));
    expect(state.isNormalized()).toBe(true);
  });

  it('on all qubits is the same as a Hadamard on each qubit, in any order', () => {
    const original = arbitraryState(3, 81);
    const all = original.clone().applyHadamardAll();
    const oneByOne = original.clone().applyGate(Gates.H, 2).applyGate(Gates.H, 0).applyGate(Gates.H, 1);
    expectStatesEqual(all, oneByOne);
  });

  it('on all qubits, applied twice, returns the original state', () => {
    const original = arbitraryState(4, 82);
    expectStatesEqual(original.clone().applyHadamardAll().applyHadamardAll(), original);
  });

  it('on all qubits of any basis state |x⟩ gives amplitudes (−1)^(x·y) / √(2^n)', () => {
    const qubitCount = 3;
    const dimension = 2 ** qubitCount;

    for (let x = 0; x < dimension; x += 1) {
      const state = QuantumState.basis(qubitCount, x).applyHadamardAll();
      const expected = Array.from(
        { length: dimension },
        (_, y) => (bitwiseDotProduct(x, y) === 0 ? 1 : -1) / Math.sqrt(dimension),
      );
      expectAmplitudes(state, expected);
    }
  });
});
