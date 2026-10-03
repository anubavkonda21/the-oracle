import {
  agreementNeeded,
  judgeConclusion,
  soleOutput,
  type ConclusionStanding,
  type Evidence,
  type ObservedOutputs,
} from '../systems/oracle/evidence';
import type { OracleKind } from '../systems/oracle/oracleKind';

/**
 * The number of queries after which the laboratory discloses the constraint
 * the machine is under. Until then the player is investigating a machine
 * about which nothing is known. It falls on the query at which the laboratory
 * remarks that what the machine does "is still unknown" — and the constraint
 * is the one thing that IS known.
 */
export const PROMISE_REVEAL_QUERY = 8;

export const PROMISE_TIMING = {
  /**
   * How long after the constraint starts to appear the objective changes:
   * once the last of it — the names of the two kinds — has arrived. (The
   * arrival itself is CSS, `.constraint` in oracle.css; a test keeps the two
   * in step.)
   */
  objectiveDelayMs: 3600,
  /** The same wait when the player has asked for reduced motion: the constraint is simply there, and the objective follows at once. */
  reducedMotionObjectiveDelayMs: 300,
} as const;

/** How one of the two kinds is presented: first by what such a machine does, then by name. */
interface RuleCopy {
  readonly name: string;
  /** What a machine of this kind does. Shown before the name is. */
  readonly behaviour: string;
  /** How the inputs divide between the two outputs, e.g. "32 / 32". */
  readonly split: (inputSpaceSize: number) => string;
  /** The same, in words, for a screen reader. */
  readonly splitInWords: (inputSpaceSize: number) => string;
}

const RULES: Record<OracleKind, RuleCopy> = {
  constant: {
    name: 'CONSTANT',
    behaviour: 'Every possible input produces the same output.',
    split: (inputSpaceSize) => `${inputSpaceSize} / 0`,
    splitInWords: (inputSpaceSize) => `All ${inputSpaceSize} inputs give one output.`,
  },
  balanced: {
    name: 'BALANCED',
    behaviour: 'Half of all possible inputs produce 0. Half produce 1.',
    split: (inputSpaceSize) => `${inputSpaceSize / 2} / ${inputSpaceSize / 2}`,
    splitInWords: (inputSpaceSize) => `${inputSpaceSize / 2} inputs give 0 and ${inputSpaceSize / 2} give 1.`,
  },
};

/** The word for each standing a conclusion can have, and for having none. */
const STANDING: Record<ConclusionStanding | 'none', string> = {
  none: 'NONE',
  established: 'ESTABLISHED',
  'not-established': 'NOT ESTABLISHED',
  contradicted: 'CONTRADICTED',
};

/** The largest number of inputs on record that share an output. */
const agreement = (evidence: Evidence): number => Math.max(evidence.zeros, evidence.ones);

/**
 * Everything the player reads about the promise, in one place.
 *
 * This is the only file in the game allowed to put the words "constant" and
 * "balanced" in front of the player, and the interface shows none of it until
 * the constraint has been disclosed (tests/game/playerFacingText.test.ts
 * enforces the first; the laboratory view, the second).
 *
 * The order is deliberate. The player is told there are two rules, then what
 * a machine under each rule does, and only then what the two are called.
 *
 * None of it says which kind this machine is. Nothing in the game knows.
 * What is said about a conclusion is only how it stands against the record:
 * the evidence the player has gathered, never the answer.
 */
export const PROMISE_COPY = {
  /** The system state the machine reports. */
  heading: 'ORACLE CONSTRAINT',
  statement: 'This machine is guaranteed to obey one of two rules.',
  rules: RULES,
  objective: 'Determine which kind of Oracle you are dealing with.',

  /** Said once, for a screen reader, as the constraint is disclosed. */
  announcement: `Oracle constraint. This machine is guaranteed to obey one of two rules. Constant: ${RULES.constant.behaviour} Balanced: ${RULES.balanced.behaviour}`,
  objectiveAnnouncement: (objective: string): string => `New objective. ${objective}`,

  /** What the record shows: which outputs have been observed. It states the evidence and draws no conclusion from it. */
  evidence: {
    label: 'OUTPUTS OBSERVED',
    observed: {
      none: 'NONE',
      zero: '0 ONLY',
      one: '1 ONLY',
      both: '0 AND 1',
    } satisfies Record<ObservedOutputs, string>,
  },

  /** The conclusion the player has put on record, and how the record bears on it. */
  conclusion: {
    label: 'CONCLUSION',
    /** Names the pair of controls for a screen reader. */
    choose: 'Record a conclusion',
    standing: STANDING,

    /** The part of the evidence that decides how a conclusion stands. */
    reason(conclusion: OracleKind, evidence: Evidence): string {
      const standing = judgeConclusion(conclusion, evidence);
      const { inputSpaceSize } = evidence;
      const agree = `${agreement(evidence)} OF ${inputSpaceSize} AGREE`;

      if (agreement(evidence) === 0) {
        return 'NOTHING OBSERVED';
      }
      if (conclusion === 'constant') {
        if (standing === 'contradicted') {
          return '0 AND 1 OBSERVED';
        }
        return standing === 'established' ? agree : `${agree} · ${agreementNeeded(inputSpaceSize)} NEEDED`;
      }
      if (standing === 'established') {
        return '0 AND 1 OBSERVED';
      }
      return standing === 'contradicted' ? agree : `ONLY ${soleOutput(evidence)?.output ?? 0} OBSERVED`;
    },

    /** The same, in full sentences, for a screen reader. `null` is a conclusion withdrawn. */
    announcement(conclusion: OracleKind | null, evidence: Evidence): string {
      if (!conclusion) {
        return 'Conclusion withdrawn.';
      }
      const standing = judgeConclusion(conclusion, evidence);
      const { inputSpaceSize } = evidence;
      const agree = `${agreement(evidence)} of ${inputSpaceSize} inputs agree`;
      const verdict = {
        established: 'Established by the record.',
        'not-established': 'Not established by the record.',
        contradicted: 'Contradicted by the record.',
      }[standing];

      let reason: string;
      if (agreement(evidence) === 0) {
        reason = 'Nothing has been observed.';
      } else if (conclusion === 'constant') {
        if (standing === 'contradicted') {
          reason = 'Both outputs have been observed.';
        } else {
          reason = standing === 'established' ? `${agree}.` : `${agree}; ${agreementNeeded(inputSpaceSize)} are needed.`;
        }
      } else if (standing === 'established') {
        reason = 'Both outputs have been observed.';
      } else {
        reason = standing === 'contradicted' ? `${agree}.` : `Only ${soleOutput(evidence)?.output ?? 0} has been observed.`;
      }
      return `Conclusion: ${RULES[conclusion].name.toLowerCase()}. ${verdict} ${reason}`;
    },
  },
} as const;
