import { PROMISE_REVEAL_QUERY } from '../../config/promiseConfig';
import type { Investigation, InvestigationProgress } from './Investigation';
import { gatherEvidence, judgeConclusion, type ConclusionStanding, type Evidence } from './evidence';
import { ORACLE_KINDS, type OracleKind } from './oracleKind';

/**
 * True once the laboratory has disclosed the constraint the machine is under.
 * From then on the task is no longer to find out everything the machine does,
 * but to tell which of the two kinds it is. It follows from the number of
 * queries alone, so it needs no memory: an investigation that has got this
 * far has been told.
 */
export function promiseIsRevealed(progress: InvestigationProgress): boolean {
  return progress.queryCount >= PROMISE_REVEAL_QUERY;
}

/**
 * The classification task: deciding which kind of machine this is.
 *
 * It holds the one thing the investigation's record does not — the conclusion
 * the player has put on record — and says how that conclusion stands against
 * the evidence.
 *
 * It knows no more than the player does. The evidence is counted from the
 * investigation's record each time it is asked for; the machine and its
 * hidden function are out of its reach. So it cannot say whether a conclusion
 * is right. It can only say whether the record establishes it, contradicts
 * it, or leaves it open — which is all the player can know either.
 */
export class Classification {
  readonly #investigation: Investigation;
  #conclusion: OracleKind | null = null;

  constructor(investigation: Investigation) {
    this.#investigation = investigation;
  }

  /** What the record shows, counted afresh from the record as it now stands. */
  get evidence(): Evidence {
    return gatherEvidence(this.#investigation.record, this.#investigation.inputSpaceSize);
  }

  /** The conclusion on record, or `null` if there is none. */
  get conclusion(): OracleKind | null {
    return this.#conclusion;
  }

  /**
   * Puts a conclusion on record, in place of any other. Concluding the same
   * thing again withdraws it: a conclusion can be changed or taken back at
   * any time, as the evidence comes in.
   */
  conclude(kind: OracleKind): void {
    if (!ORACLE_KINDS.includes(kind)) {
      throw new TypeError(`A conclusion must be one of the two kinds of machine; received ${String(kind)}.`);
    }
    this.#conclusion = this.#conclusion === kind ? null : kind;
  }

  /** How the conclusion on record stands against the evidence, or `null` if there is no conclusion. */
  get standing(): ConclusionStanding | null {
    return this.#conclusion ? judgeConclusion(this.#conclusion, this.evidence) : null;
  }
}
