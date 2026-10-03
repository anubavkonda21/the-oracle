import type { OracleQuery } from './GameOracle';
import type { OracleKind } from './oracleKind';

/**
 * CLASSICAL EVIDENCE: what can be said about the machine from the record of
 * its answers, and nothing else.
 *
 * Everything in this file works from the record — the list of inputs that
 * have been asked and the outputs that came back. It never sees the machine,
 * never works out an answer that has not been observed, and uses none of the
 * quantum engine (a test enforces all three). So whatever it concludes is
 * something the player could conclude too, from the same record.
 *
 * The reasoning rests on the promise (oracleKind.ts):
 *
 *   - Two different outputs on record: the machine cannot be constant.
 *     Under the promise that leaves balanced.
 *   - One output only: both kinds are still possible. A balanced machine
 *     gives each output for half of all inputs, so it can agree with itself
 *     that many times and no more.
 *   - One output, for MORE than half of all inputs: the machine cannot be
 *     balanced. Under the promise that leaves constant.
 *
 * For 64 inputs, that last case takes 33 identical answers.
 */

/** An output of the machine. Taken from the record's own type, so this module needs nothing from the engine. */
type Output = OracleQuery['output'];

/** What the record shows, counted. */
export interface Evidence {
  /** How many different inputs the machine can be given. */
  readonly inputSpaceSize: number;
  /** How many different inputs are on record with the output 0. */
  readonly zeros: number;
  /** How many different inputs are on record with the output 1. */
  readonly ones: number;
}

/**
 * Counts the record. Each input counts once, however often it appears. A
 * record in which one input has two different outputs is refused: a machine
 * with a fixed function cannot produce it.
 */
export function gatherEvidence(record: readonly OracleQuery[], inputSpaceSize: number): Evidence {
  if (!Number.isInteger(inputSpaceSize) || inputSpaceSize < 2 || inputSpaceSize % 2 !== 0) {
    throw new RangeError(`An input space has an even number of inputs, at least 2; received ${inputSpaceSize}.`);
  }

  const observed = new Map<string, Output>();
  for (const { input, output } of record) {
    const earlier = observed.get(input);
    if (earlier !== undefined && earlier !== output) {
      throw new RangeError(`The record gives input ${input} two different outputs, which a fixed machine cannot do.`);
    }
    observed.set(input, output);
  }
  if (observed.size > inputSpaceSize) {
    throw new RangeError(`The record holds ${observed.size} different inputs, more than the ${inputSpaceSize} that exist.`);
  }

  const ones = [...observed.values()].filter((output) => output === 1).length;
  return Object.freeze({ inputSpaceSize, zeros: observed.size - ones, ones });
}

/** Which outputs are on record. */
export type ObservedOutputs = 'none' | 'zero' | 'one' | 'both';

export function observedOutputs(evidence: Evidence): ObservedOutputs {
  if (evidence.zeros > 0 && evidence.ones > 0) {
    return 'both';
  }
  if (evidence.zeros > 0) {
    return 'zero';
  }
  return evidence.ones > 0 ? 'one' : 'none';
}

/** The output every answer on record agrees on, and how many there are — or `null` if there are none, or two outputs. */
export function soleOutput(evidence: Evidence): { readonly output: Output; readonly count: number } | null {
  switch (observedOutputs(evidence)) {
    case 'zero':
      return { output: 0, count: evidence.zeros };
    case 'one':
      return { output: 1, count: evidence.ones };
    default:
      return null;
  }
}

/**
 * How many inputs must agree before a machine can no longer be balanced: one
 * more than half. A balanced machine gives each output for exactly half of
 * all inputs, so half can agree by coincidence — and not one more.
 */
export function agreementNeeded(inputSpaceSize: number): number {
  return inputSpaceSize / 2 + 1;
}

/**
 * Which kinds of machine the evidence leaves possible. This needs no
 * promise: it is only what the record rules out.
 *
 *   constant is ruled out by two different outputs
 *   balanced is ruled out by more than half of all inputs sharing an output
 */
export function possibleKinds(evidence: Evidence): Readonly<Record<OracleKind, boolean>> {
  const half = evidence.inputSpaceSize / 2;
  return {
    constant: evidence.zeros === 0 || evidence.ones === 0,
    balanced: evidence.zeros <= half && evidence.ones <= half,
  };
}

/**
 * What the evidence settles, GIVEN THE PROMISE that the machine is one of the
 * two kinds.
 *
 *   constant, balanced — the other kind has been ruled out
 *   undetermined       — both kinds are still possible
 *   neither            — both have been ruled out: the promise was broken.
 *                        A machine built by `createPromisedOracle` never gets here.
 */
export type EvidenceVerdict = OracleKind | 'undetermined' | 'neither';

export function classifyEvidence(evidence: Evidence): EvidenceVerdict {
  const possible = possibleKinds(evidence);

  if (possible.constant && possible.balanced) {
    return 'undetermined';
  }
  if (possible.constant) {
    return 'constant';
  }
  return possible.balanced ? 'balanced' : 'neither';
}

/**
 * How a conclusion stands against the evidence, given the promise.
 *
 *   established     — the evidence has ruled the other kind out
 *   not-established — the evidence allows it, but allows the other kind too
 *   contradicted    — the evidence has ruled it out
 */
export type ConclusionStanding = 'established' | 'not-established' | 'contradicted';

export function judgeConclusion(conclusion: OracleKind, evidence: Evidence): ConclusionStanding {
  const verdict = classifyEvidence(evidence);

  if (verdict === conclusion) {
    return 'established';
  }
  // Anything else the evidence has settled on — the other kind, or neither — rules this conclusion out.
  return verdict === 'undetermined' ? 'not-established' : 'contradicted';
}
