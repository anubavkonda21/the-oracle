import { formatQueryId } from '../../utils/format';
import type { OracleQuery } from '../systems/oracle/GameOracle';
import type { InvestigationProgress } from '../systems/oracle/Investigation';
import { agreementNeeded } from '../systems/oracle/evidence';

/**
 * What the laboratory says about the investigation, in one place.
 *
 * Everything here describes the record — what has been asked, and how much
 * has not. None of it says what the machine's rule is, what kind of rule it
 * might be, or that a different way of asking exists; the most it does is
 * wonder. Those belong to later parts of the game.
 */
export const INVESTIGATION_COPY = {
  inputSpace: {
    heading: 'INPUT SPACE',
    bits: (inputLength: number): string => `${inputLength} ${inputLength === 1 ? 'BIT' : 'BITS'}`,
    possibleInputs: (inputSpaceSize: number): string => `${inputSpaceSize} POSSIBLE INPUTS`,
    tested: 'TESTED',
    untested: 'UNTESTED',
    /** Read out in place of the picture, which assistive technology cannot see. */
    description: ({ testedCount, inputSpaceSize }: InvestigationProgress): string =>
      `${testedCount} of ${inputSpaceSize} possible inputs tested.`,
  },

  /** The line under the input: what the record holds for the input as it stands. */
  record: {
    untested: 'UNTESTED',
    tested: (query: OracleQuery): string => `TESTED · ${formatQueryId(query.number)} · OUTPUT ${query.output}`,
    /** Added when the player asks about an input that is already on record. */
    noQueryUsed: 'NO QUERY USED',
    /** The same, in full sentences, for a screen reader. */
    recalledAnnouncement: (query: OracleQuery): string =>
      `This input is already on record. Query ${query.number} gave output ${query.output}. No query was used.`,
  },
} as const;

/** A count with its noun, e.g. "1 query" or "32 queries". */
const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** One of the laboratory's remarks on the investigation, and when it starts to apply. */
export interface InvestigationNoteRule {
  /** The number of queries from which this remark applies, for an input space of the given size. */
  readonly fromQuery: (inputSpaceSize: number) => number;
  readonly text: (progress: InvestigationProgress) => string;
}

/**
 * What the laboratory remarks as the record grows, in the order the remarks
 * arrive. One is shown at a time, and none before the first query: the player
 * acts first.
 *
 * They follow the player's own train of thought — it answers; each answer
 * covers one input; there are a great many inputs; this is going to take a
 * while; is there a better way to ask? — and they are spaced so that the last
 * of those is reached within about a dozen queries. Each one is true for as
 * long as it is shown.
 *
 * Part-way through, at the remark that the machine "is still unknown", the
 * laboratory discloses the one thing that is known about it (promiseConfig.ts).
 * The remarks after that are about telling the two kinds apart.
 */
export const INVESTIGATION_NOTES: readonly InvestigationNoteRule[] = [
  {
    fromQuery: () => 1,
    text: ({ inputSpaceSize }) => `The machine answered. That is one input out of ${inputSpaceSize}.`,
  },
  {
    fromQuery: () => 3,
    text: () => 'Each answer describes a single input, and no other.',
  },
  {
    fromQuery: () => 5,
    text: ({ untestedCount, inputSpaceSize }) =>
      `${untestedCount} of the ${inputSpaceSize} possible inputs ${untestedCount === 1 ? 'is' : 'are'} untested.`,
  },
  {
    fromQuery: () => 8,
    text: ({ queryCount }) => `${queryCount} answers on record. What the machine does is still unknown.`,
  },
  {
    // By now the laboratory has disclosed that the machine is one of two kinds (see promiseConfig.ts),
    // so the cost that matters is the cost of being sure which: more than half of all inputs, at worst.
    fromQuery: () => 11,
    text: ({ inputSpaceSize }) =>
      `One input at a time, certainty can take as many as ${agreementNeeded(inputSpaceSize)} queries.`,
  },
  {
    fromQuery: () => 14,
    text: () => 'There may be a better way to ask.',
  },
  {
    fromQuery: (inputSpaceSize) => inputSpaceSize / 2,
    text: ({ queryCount, untestedCount }) =>
      `${counted(queryCount, 'query', 'queries')}, and ${counted(untestedCount, 'input is', 'inputs are')} still unknown. There may be a better way to ask.`,
  },
  {
    fromQuery: (inputSpaceSize) => inputSpaceSize,
    text: ({ inputSpaceSize }) => `Every input is on record. It took ${inputSpaceSize} queries: one for each.`,
  },
];
