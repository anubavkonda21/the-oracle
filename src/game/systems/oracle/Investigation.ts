import type { GameOracle, OracleQuery } from './GameOracle';
import { inputSpaceSize } from './inputSpace';

/** How far an investigation has got. */
export interface InvestigationProgress {
  /** Questions the machine has been asked. Looking an answer up in the record is not one of them. */
  readonly queryCount: number;
  /** Different inputs whose answer is on record. */
  readonly testedCount: number;
  /** Inputs the machine has never been asked about. */
  readonly untestedCount: number;
  /** How many different inputs there are: 2^n for an n-bit input. */
  readonly inputSpaceSize: number;

}

/**
 * What came of asking about an input.
 *
 *   asked    — a new question: the machine was asked, and its answer is now on record
 *   recalled — already on record: the machine was NOT asked, and the earlier entry is handed back
 */
export type AskOutcome =
  | { readonly kind: 'asked'; readonly query: OracleQuery }
  | { readonly kind: 'recalled'; readonly query: OracleQuery };

/**
 * The player's investigation of the machine: the record of what it has been
 * asked, and the discipline of never asking it the same thing twice.
 *
 * The machine (`GameOracle`) simply answers whatever it is given, and counts
 * every question. This is the notebook kept beside it. The record is consulted
 * first, and an input that is already there is answered from the record — the
 * machine is not touched, so a repeated input never uses a query. That is
 * sound because the machine's hidden function is fixed: the same input always
 * gets the same answer.
 *
 * The machine's own record is the single source of truth. Nothing is copied
 * here that could drift out of step with it.
 *
 * Like the machine, this reveals nothing about the hidden function beyond the
 * answers that have actually been obtained.
 */
export const ORACLE_INSTANCE = Symbol('oracle');

export class Investigation {
  /** Number of bits in an input. */
  readonly inputLength: number;
  /** How many different inputs there are to ask about. */
  readonly inputSpaceSize: number;

  readonly #oracle: GameOracle;

  constructor(oracle: GameOracle) {
    this.#oracle = oracle;
    (this as any)[ORACLE_INSTANCE] = oracle;
    this.inputLength = oracle.inputLength;
    this.inputSpaceSize = inputSpaceSize(oracle.inputLength);
  }

  /**
   * Asks about an input. If the record already holds it, that entry is
   * returned and the machine is left alone; otherwise the machine is asked,
   * which uses one query. An input the machine cannot accept is refused by
   * the machine, and nothing is recorded.
   */
  ask(input: string): AskOutcome {
    const recorded = this.find(input);
    if (recorded) {
      return { kind: 'recalled', query: recorded };
    }
    return { kind: 'asked', query: this.#oracle.query(input) };
  }

  /** The record's entry for an input, or `undefined` if it has never been asked. Looking is free. */
  find(input: string): OracleQuery | undefined {
    return this.#oracle.history.find((query) => query.input === input);
  }

  /** Every question the machine has answered, oldest first. A copy: changing it does not change the record. */
  get record(): readonly OracleQuery[] {
    return this.#oracle.history;
  }

  get progress(): InvestigationProgress {
    const record = this.#oracle.history;
    const testedCount = new Set(record.map((query) => query.input)).size;

    return Object.freeze({
      queryCount: record.length,
      testedCount,
      untestedCount: this.inputSpaceSize - testedCount,
      inputSpaceSize: this.inputSpaceSize,
    });
  }
}
