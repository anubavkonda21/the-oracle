import type { Bit } from '../../quantum';

/** Vertical centre of the box in the 1440 × 900 design frame: above the middle, leaving room for the report beneath it. */
export const BOX_CENTER_Y = 300;

export const BOX_TIMING = {
  /** The held moment between choosing to observe and the measurement. Nothing moves. */
  holdMs: 900,
  /** The shutter rising to show what was found. */
  openMs: 900,
  /** The same two waits when the player has asked for reduced motion: the shutter does not animate. */
  reducedMotionHoldMs: 500,
  reducedMotionOpenMs: 150,
} as const;

/**
 * Everything the player reads in THE BOX, in one place.
 *
 * This is the only file in the game allowed to use the words "superposition"
 * and "quantum" in player-facing text, and only in the context shown after
 * the observation (tests/game/playerFacingText.test.ts enforces both).
 *
 * The wording is deliberate. It says the system "was described by" a
 * superposition — a statement about the description, not a claim that an
 * animal was two things at once — and it attributes the result to
 * measurement, never to being looked at by a person.
 */
export const BOX_COPY = {
  label: 'THE BOX',
  status: {
    sealed: 'SEALED',
    observing: 'OBSERVING',
    observed: 'OBSERVED',
  },
  /** Shown beneath the sealed box. Deliberately says nothing about what will happen. */
  sealedNote: 'CONTENTS: UNOBSERVED',
  observe: 'OBSERVE',
  observeAgain: 'OBSERVE AGAIN',
  returnToOracle: 'RETURN TO THE ORACLE',
  leave: 'RETURN',
  complete: 'OBSERVATION COMPLETE',
  result: 'RESULT',
  /** How each outcome is named. The words describe the picture; the bit is what was measured. */
  outcomes: {
    0: 'STILL',
    1: 'AWAKE',
  } satisfies Record<Bit, string>,
  /** The whole explanation: three sentences, read in a few seconds, shown only after the player has acted. */
  context: [
    'Before measurement, the system was described by a superposition of possible outcomes.',
    'Measurement produced one definite result.',
    'Schrödinger’s cat was a thought experiment, designed to expose the strange consequences of applying quantum ideas to everyday objects.',
  ],
} as const;
