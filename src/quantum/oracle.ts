import { truthTable, type Bit, type BooleanFunction } from './booleanFunction';
import type { QuantumState } from './state';

/*
 * REGISTER LAYOUT of an oracle for an n-bit function, on n + 1 qubits:
 *
 *   qubits 0 … n−1   the input register |x⟩
 *   qubit  n         the ancilla |y⟩ (the last qubit: the rightmost character of a label)
 *
 * so the basis state |x⟩|y⟩ has basis index 2x + y, and its label is the
 * n bits of x followed by y.
 */

/**
 * A quantum oracle U_f for a Boolean function f. It is a black box: it can be
 * applied to a state, and nothing else about f can be read from it.
 */
export interface QuantumOracle {
  readonly inputQubitCount: number;
  /** Qubits the oracle acts on: the input register plus one ancilla. */
  readonly qubitCount: number;
  /** How many times the oracle has been applied. Each application is one query to f. */
  readonly queryCount: number;
  /** Applies U_f to the state in place — one query — and returns the state. */
  applyTo(state: QuantumState): QuantumState;
}

/**
 * The standard bit-flip oracle:
 *
 *   U_f |x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩
 *
 * It leaves the input register alone and flips the ancilla exactly when
 * f(x) = 1. That only relabels basis states, and applying it twice undoes
 * it, so it is a permutation of the basis and therefore unitary — for ANY
 * function f, including ones that are not reversible themselves.
 */
class BitFlipOracle implements QuantumOracle {
  readonly inputQubitCount: number;
  readonly qubitCount: number;

  // Runtime-private (#), not merely compile-time private: the function's outputs cannot be read from outside.
  readonly #outputs: readonly Bit[];
  #queryCount = 0;

  constructor(f: BooleanFunction) {
    this.inputQubitCount = f.inputQubitCount;
    this.qubitCount = f.inputQubitCount + 1;
    // The simulator has to know the whole unitary to apply it, so f is tabulated once, here.
    // That is the cost of SIMULATING the oracle; it is not a query made by any algorithm.
    this.#outputs = truthTable(f);
  }

  get queryCount(): number {
    return this.#queryCount;
  }

  applyTo(state: QuantumState): QuantumState {
    if (state.qubitCount !== this.qubitCount) {
      throw new RangeError(
        `This oracle acts on ${this.qubitCount} qubits (${this.inputQubitCount} input + 1 ancilla); the state has ${state.qubitCount}.`,
      );
    }

    const outputs = this.#outputs;
    state.applyBasisPermutation((basisIndex) => {
      const input = basisIndex >> 1; // drop the ancilla bit to leave x
      return basisIndex ^ (outputs[input] ?? 0); // flip the ancilla bit when f(x) = 1
    });

    this.#queryCount += 1;
    return state;
  }
}

/** Builds the bit-flip oracle U_f for a Boolean function. */
export function createOracle(f: BooleanFunction): QuantumOracle {
  return new BitFlipOracle(f);
}
