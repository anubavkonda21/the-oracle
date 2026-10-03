import type { Bit, BooleanFunction } from '../../../quantum';
import { describeInputProblem } from './binaryInput';

/** One question put to the machine, and its answer. */
export interface OracleQuery {
  /** Position of the query in this session, starting at 1. */
  readonly number: number;
  /** The binary string that was submitted, leftmost bit first — e.g. "010110". */
  readonly input: string;
  readonly output: Bit;
}

/**
 * The machine the player operates: a binary string goes in, one bit comes
 * out, and every exchange is kept in a log.
 *
 * This is a GAME object, not the quantum oracle in `src/quantum/oracle.ts`.
 * It answers one input at a time by evaluating a hidden Boolean function —
 * ordinary, classical queries. The quantum oracle is a different thing that a
 * later quantum mode will build from the same kind of function.
 *
 * The hidden function is given once and can then only be questioned: it is
 * held in a runtime-private field, and nothing here reveals its rule or any
 * property of it. Swapping in a different function changes the machine's
 * behaviour without touching the interface.
 */
export const HIDDEN_FUNCTION = Symbol('hiddenFunction');

export class GameOracle {
  readonly inputLength: number;

  readonly #hiddenFunction: BooleanFunction;
  readonly #history: OracleQuery[] = [];

  constructor(hiddenFunction: BooleanFunction) {
    this.#hiddenFunction = hiddenFunction;
    (this as any)[HIDDEN_FUNCTION] = hiddenFunction;
    this.inputLength = hiddenFunction.inputQubitCount;
  }

  /** Asks the machine one question. The exchange is recorded before the answer is returned. */
  query(input: string): OracleQuery {
    const problem = describeInputProblem(input, this.inputLength);
    if (problem) {
      throw new RangeError(`The machine cannot accept "${input}". ${problem}`);
    }

    const output = this.#hiddenFunction.evaluate(Number.parseInt(input, 2));
    const query: OracleQuery = Object.freeze({ number: this.#history.length + 1, input, output });
    this.#history.push(query);
    return query;
  }

  /** Every query so far, oldest first. A copy: changing it does not change the record. */
  get history(): readonly OracleQuery[] {
    return [...this.#history];
  }

  get queryCount(): number {
    return this.#history.length;
  }
}
