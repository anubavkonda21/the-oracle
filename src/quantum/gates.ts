import { ComplexNumber } from './complex';

/** A 2 × 2 complex matrix, written row by row: [[m00, m01], [m10, m11]]. */
export type GateMatrix = readonly [
  readonly [ComplexNumber, ComplexNumber],
  readonly [ComplexNumber, ComplexNumber],
];

/**
 * A single-qubit gate: a unitary 2 × 2 matrix. Its columns say where the
 * gate sends |0⟩ and |1⟩; everything else follows from linearity.
 */
export interface Gate {
  readonly name: string;
  readonly matrix: GateMatrix;
}

type RealRow = readonly [number, number];

/** Builds a gate whose matrix entries are all real, as is the case for I, X, Z and H. */
function realGate(name: string, rows: readonly [RealRow, RealRow]): Gate {
  const toComplexRow = ([left, right]: RealRow): readonly [ComplexNumber, ComplexNumber] =>
    Object.freeze([ComplexNumber.fromReal(left), ComplexNumber.fromReal(right)] as const);

  return Object.freeze({
    name,
    matrix: Object.freeze([toComplexRow(rows[0]), toComplexRow(rows[1])] as const),
  });
}

const INVERSE_SQRT_2 = Math.SQRT1_2;

export const Gates = {
  /** Identity: leaves the qubit unchanged. */
  I: realGate('I', [
    [1, 0],
    [0, 1],
  ]),

  /** Pauli-X: exchanges the |0⟩ and |1⟩ amplitudes. */
  X: realGate('X', [
    [0, 1],
    [1, 0],
  ]),

  /** Pauli-Z: negates the |1⟩ amplitude. Probabilities are unchanged; only the relative phase flips. */
  Z: realGate('Z', [
    [1, 0],
    [0, -1],
  ]),

  /** Hadamard: H = 1/√2 · [[1, 1], [1, −1]]. Sends |0⟩ to (|0⟩ + |1⟩)/√2 and |1⟩ to (|0⟩ − |1⟩)/√2. */
  H: realGate('H', [
    [INVERSE_SQRT_2, INVERSE_SQRT_2],
    [INVERSE_SQRT_2, -INVERSE_SQRT_2],
  ]),
} as const satisfies Record<string, Gate>;

/**
 * The one place a gate matrix is multiplied out:
 *
 *   [a0']   [m00 m01] [a0]
 *   [a1'] = [m10 m11] [a1]
 *
 * where a0 and a1 are the amplitudes of two basis states that differ only in
 * the target qubit (target = 0 and target = 1 respectively).
 */
export function applyGateToPair(
  gate: Gate,
  amplitude0: ComplexNumber,
  amplitude1: ComplexNumber,
): [ComplexNumber, ComplexNumber] {
  const [[m00, m01], [m10, m11]] = gate.matrix;
  return [
    m00.multiply(amplitude0).add(m01.multiply(amplitude1)),
    m10.multiply(amplitude0).add(m11.multiply(amplitude1)),
  ];
}
