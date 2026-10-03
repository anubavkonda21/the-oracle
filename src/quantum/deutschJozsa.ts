import { QUANTUM_EPSILON } from './complex';
import { Gates } from './gates';
import type { RandomSource } from './measurement';
import type { QuantumOracle } from './oracle';
import { QuantumState, basisStateLabel } from './state';

/*
 * THE DEUTSCH–JOZSA ALGORITHM
 *
 * Promise: f is either CONSTANT or BALANCED. Task: decide which.
 *
 * Classically, certainty can take 2^(n−1) + 1 evaluations of f. This
 * algorithm applies the oracle once.
 *
 * It does not work by evaluating f on every input and reading all the
 * answers; a measurement returns one n-bit string and nothing more. It works
 * by interference:
 *
 *   • The oracle acts on a superposition of every input. With the ancilla in
 *     the state |−⟩ = (|0⟩ − |1⟩)/√2, flipping the ancilla when f(x) = 1 just
 *     multiplies that term by −1. The ancilla is left as it was, and each
 *     input's amplitude picks up the sign (−1)^f(x): phase kickback.
 *
 *   • A second round of Hadamards on the input register adds those signed
 *     amplitudes together. The amplitude of |0…0⟩ becomes
 *
 *         (1 / 2^n) · Σₓ (−1)^f(x)
 *
 *     For a constant f every term has the same sign and the sum is ±1.
 *     For a balanced f half the terms are +1 and half −1, and they cancel to 0.
 *
 *   • So measuring the input register gives all zeros with certainty if f is
 *     constant, and never if f is balanced. The measurement reveals one global
 *     property of f — not any individual value f(x).
 */

export type DeutschJozsaVerdict = 'constant' | 'balanced';

/** The points in the circuit at which a snapshot of the state is kept. */
export type DeutschJozsaStepId =
  | 'prepared' // |0…0⟩|0⟩
  | 'superposed' // Hadamards on the input register
  | 'ancilla-ready' // ancilla in |−⟩
  | 'queried' // the oracle has been applied, once
  | 'interfered' // Hadamards on the input register again
  | 'measured'; // the input register has been measured

export interface DeutschJozsaStep {
  readonly id: DeutschJozsaStepId;
  /** An independent copy of the full (input + ancilla) state at this point. */
  readonly state: QuantumState;
}

export interface DeutschJozsaResult {
  /** The algorithm's answer, decided solely by the measured value of the input register. */
  readonly verdict: DeutschJozsaVerdict;
  readonly inputQubitCount: number;
  /** What the input register measured, as a number and as a label such as "000". */
  readonly measuredInput: number;
  readonly measuredLabel: string;
  /** Probability of each possible input-register result just before measuring. Entry 0 is "all zeros". */
  readonly inputProbabilities: readonly number[];
  /** How many times this run applied the oracle, counted by the oracle itself. */
  readonly oracleQueries: number;
  /** The state after each stage of the circuit, in order. */
  readonly steps: readonly DeutschJozsaStep[];
}

/**
 * Runs the Deutsch–Jozsa circuit on the state-vector simulator.
 *
 * It is given only the oracle — a black box that can be applied to a state —
 * never the function behind it, so the verdict cannot come from anywhere but
 * the simulated measurement.
 *
 * Throws if the function behind the oracle is neither constant nor balanced:
 * the algorithm's answer is only defined when the promise holds.
 */
export function runDeutschJozsa(oracle: QuantumOracle, random: RandomSource = Math.random): DeutschJozsaResult {
  const inputQubitCount = oracle.inputQubitCount;
  const inputQubits = Array.from({ length: inputQubitCount }, (_, qubit) => qubit);
  const ancilla = inputQubitCount;

  // 1. Every qubit starts in |0⟩.
  const state = QuantumState.basis(oracle.qubitCount, 0);

  const steps: DeutschJozsaStep[] = [];
  const record = (id: DeutschJozsaStepId): void => {
    steps.push({ id, state: state.clone() });
  };
  record('prepared');

  // 2. Put the input register into an equal superposition of all 2^n inputs.
  for (const qubit of inputQubits) {
    state.applyGate(Gates.H, qubit);
  }
  record('superposed');

  // 3. Prepare the ancilla in |−⟩ = (|0⟩ − |1⟩)/√2, which is H·X|0⟩.
  state.applyGate(Gates.X, ancilla).applyGate(Gates.H, ancilla);
  record('ancilla-ready');

  // 4–5. Query the oracle once. Phase kickback writes (−1)^f(x) onto the amplitude of each input x.
  const queriesBefore = oracle.queryCount;
  oracle.applyTo(state);
  const oracleQueries = oracle.queryCount - queriesBefore;
  record('queried');

  // 6. Interfere: Hadamards on the input register only.
  for (const qubit of inputQubits) {
    state.applyGate(Gates.H, qubit);
  }
  record('interfered');

  // Under the promise, "all zeros" is now either certain or impossible. If it is neither,
  // the function was not constant or balanced and a verdict would be meaningless.
  const inputProbabilities = state.getMarginalProbabilities(inputQubits);
  const zeroProbability = inputProbabilities[0] ?? 0;
  if (zeroProbability > QUANTUM_EPSILON && zeroProbability < 1 - QUANTUM_EPSILON) {
    throw new RangeError(
      `The Deutsch–Jozsa promise does not hold: the function is neither constant nor balanced ` +
        `(the all-zeros result has probability ${zeroProbability}, where only 0 or 1 is possible under the promise).`,
    );
  }

  // 7. Measure the input register. The ancilla is not measured.
  const measuredInput = state.measureQubits(inputQubits, random);
  record('measured');

  // 8. All zeros means constant; anything else means balanced.
  const verdict: DeutschJozsaVerdict = measuredInput === 0 ? 'constant' : 'balanced';

  return {
    verdict,
    inputQubitCount,
    measuredInput,
    measuredLabel: basisStateLabel(measuredInput, inputQubitCount),
    inputProbabilities,
    oracleQueries,
    steps,
  };
}
