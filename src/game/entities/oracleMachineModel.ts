import type { Bit } from '../../quantum';
import type { DeutschJozsaStepId } from '../../quantum/deutschJozsa';
import { ORACLE_TIMING } from '../config/oracleConfig';
import type { ConclusionStanding } from '../systems/oracle/evidence';
import { PORT_COUNT, RESONATOR_COUNT, SPARE_RESONATOR, TICK_COUNT, dialIndex, shortestTurn, tickTurn } from './oracleMachineLayout';

/**
 * What the machine is showing, worked out from what it has been told.
 *
 * Two halves, both plain data and arithmetic so they can be tested without a
 * canvas:
 *
 *   MachineState — what the machine has been told: the input as composed,
 *                  the answers on record, whether it is working, how far a
 *                  quantum run has got. Changed by the functions below.
 *   MachineLook  — how bright every light on the machine is at a given
 *                  moment, worked out from the state by `computeLook`.
 *
 * The machine only LOOKS the part. Nothing here decides an answer, and
 * nothing here is given the machine's rule: the state holds only what the
 * laboratory has already put on record, and — in Quantum Mode — how far the
 * run has got and, once it is measured, what the measurement read.
 */

export type MachineMode = 'classical' | 'quantum';

/** The stages of a quantum run, in order. They are the simulator's own names for them. */
export const QUANTUM_STAGES: readonly DeutschJozsaStepId[] = [
  'prepared',
  'superposed',
  'ancilla-ready',
  'queried',
  'interfered',
  'measured',
];

const STAGE = { prepared: 0, superposed: 1, spareReady: 2, queried: 3, interfered: 4, measured: 5 } as const;

/** A time that has not happened: every animation counted from it is long over, or has not begun. */
const NEVER = Number.NEGATIVE_INFINITY;
const NOT_YET = Number.POSITIVE_INFINITY;

export interface MachineState {
  mode: MachineMode;
  /** With reduced motion nothing pulses, sweeps or travels: every light simply takes its value. */
  still: boolean;
  /**
   * The machine at rest: every light out but the status light. It is at rest
   * whenever nobody is working at it — on the title screen, and after a run.
   * `restingAt` is when it last went to rest, or was woken.
   */
  resting: boolean;
  restingAt: number;

  /** The input as composed, leftmost bit first; when it last changed; and which bit changed, if it was only one. */
  input: string;
  inputAt: number;
  changedBit: number | null;
  /** The record: the answer to each input that has been asked, by dial index. `null` is an input not yet asked. */
  record: (Bit | null)[];
  /** The answer in the eye — the record's entry for the input as composed — and whether it is the answer just given. */
  shown: Bit | null;
  fresh: boolean;
  answeredAt: number;
  working: boolean;
  workingAt: number;
  /** When the player last asked about an input that was already on record. */
  recalledAt: number;
  /** The resonators stay capped until the laboratory discloses the constraint. */
  sealed: boolean;
  unsealedAt: number;
  /** How the conclusion on record stands against the evidence, and when that last changed. */
  standing: ConclusionStanding | null;
  standingAt: number;

  /** Quantum Mode: the stage the run has reached (an index into QUANTUM_STAGES; −1 before a run) and when each began. */
  stage: number;
  stageAt: number[];
  /** What the measurement read, leftmost bit first. Set only once the run has been measured. */
  measured: string | null;
}

export function createMachineState(mode: MachineMode): MachineState {
  return {
    mode,
    still: false,
    resting: false,
    restingAt: NEVER,
    input: '0'.repeat(PORT_COUNT),
    inputAt: NEVER,
    changedBit: null,
    record: new Array<Bit | null>(TICK_COUNT).fill(null),
    shown: null,
    fresh: false,
    answeredAt: NEVER,
    working: false,
    workingAt: NEVER,
    recalledAt: NEVER,
    // In Quantum Mode the resonators are what the machine is for; they are never capped there.
    sealed: mode === 'classical',
    unsealedAt: NEVER,
    standing: null,
    standingAt: NEVER,
    stage: -1,
    stageAt: new Array<number>(QUANTUM_STAGES.length).fill(NOT_YET),
    measured: null,
  };
}

/* ---------- What the machine is told ---------- */

/**
 * Starts the machine afresh in a mode: nothing on record, nothing running.
 * The one machine in the room is used for every investigation and every run,
 * so this is how each of them begins. Whether it is at rest is left as it is.
 */
export function resetMachine(state: MachineState, mode: MachineMode): void {
  const { still, resting, restingAt } = state;
  Object.assign(state, createMachineState(mode), { still, resting, restingAt });
}

/** Puts the machine to rest, or wakes it. With `arrive` off the change is simply there. */
export function setResting(state: MachineState, resting: boolean, now: number, arrive: boolean): void {
  if (state.resting === resting) {
    return;
  }
  state.resting = resting;
  state.restingAt = arrive ? now : NEVER;
}

/**
 * The input as it now stands, and the record's answer for it (`null` if it
 * has not been asked). While the machine is working the eye is busy, and
 * stays so whatever the record holds.
 */
export function setInput(state: MachineState, input: string, recorded: Bit | null, now: number): void {
  if (input !== state.input) {
    const changed: number[] = [];
    for (let bit = 0; bit < PORT_COUNT; bit += 1) {
      if (input[bit] !== state.input[bit]) {
        changed.push(bit);
      }
    }
    state.changedBit = changed.length === 1 ? (changed[0] ?? null) : null;
    state.input = input;
    state.inputAt = now;
    state.fresh = false;
  }
  if (!state.working) {
    // The answer just given stays as it arrived for as long as the input it answers is the one composed.
    state.fresh = state.fresh && recorded === state.shown && recorded !== null;
    state.shown = recorded;
  }
}

/** The machine has been asked: it clears its eye and sets to work. */
export function startWorking(state: MachineState, now: number): void {
  state.working = true;
  state.workingAt = now;
  state.shown = null;
  state.fresh = false;
}

/** The machine answers the input as composed. With `arrive` off the answer is simply there. */
export function setAnswer(state: MachineState, output: Bit, now: number, arrive: boolean): void {
  state.working = false;
  state.record[dialIndex(state.input)] = output;
  state.shown = output;
  state.fresh = true;
  state.answeredAt = arrive ? now : NEVER;
}

/** Puts answers that are already on record back on the dial, with no ceremony. */
export function restoreRecord(state: MachineState, record: readonly { readonly input: string; readonly output: Bit }[]): void {
  for (const query of record) {
    state.record[dialIndex(query.input)] = query.output;
  }
}

/** The player asked about an input that is already on record: the machine is not asked, and says so quietly. */
export function recall(state: MachineState, now: number): void {
  state.recalledAt = now;
}

/** The constraint has been disclosed: the caps come off the resonators. */
export function unseal(state: MachineState, now: number, arrive: boolean): void {
  if (!state.sealed) {
    return;
  }
  state.sealed = false;
  state.unsealedAt = arrive ? now : NEVER;
}

/** How the player's conclusion stands against the evidence has changed. With `arrive` off nothing is made of it. */
export function setStanding(state: MachineState, standing: ConclusionStanding | null, now: number, arrive: boolean): void {
  state.standing = standing;
  state.standingAt = arrive && standing ? now : NEVER;
}

/** A quantum run is about to start: whatever the last run left on the machine is cleared. */
export function beginRun(state: MachineState): void {
  state.stage = -1;
  state.stageAt.fill(NOT_YET);
  state.measured = null;
}

/**
 * The run has reached a stage. The only thing the machine is ever told about
 * the outcome is what the measurement read — and only at the measurement.
 */
export function reachStage(state: MachineState, id: DeutschJozsaStepId, now: number, measured?: string): void {
  const stage = QUANTUM_STAGES.indexOf(id);
  if (stage < 0) {
    return;
  }
  // Stages arrive in order. If one was skipped, it began when the one after it did.
  for (let earlier = 0; earlier <= stage; earlier += 1) {
    if (state.stageAt[earlier] === NOT_YET) {
      state.stageAt[earlier] = now;
    }
  }
  state.stage = Math.max(state.stage, stage);
  if (stage === STAGE.measured && measured !== undefined && /^[01]+$/.test(measured) && measured.length === PORT_COUNT) {
    state.measured = measured;
  }
}

/* ---------- How it looks ---------- */

export interface MachineLook {
  /** Which light the machine is lit by: 0 is the classical white, 1 the quantum light. */
  hue: number;
  /** How much of the eye's light has turned to the warning colour. */
  alarm: number;
  /** The dial's pointer: where it should be, in turns, and how brightly it shows. */
  pointerTurn: number;
  pointerLevel: number;
  /** Brightness of each port, in the order of the bits. */
  ports: number[];
  /** Brightness of each tick on the dial, and whether it is drawn short (an answer of 0) or full. */
  ticks: number[];
  tickShort: boolean[];
  /**
   * The eye: an even fill of light, a glow at its centre, a hollow ring, a hot core, and the digit behind the glass.
   * The fill and the ring are how an answer is shown — a 1 fills the eye, a 0 rings it. The glow and the core
   * are the machine at work, and are never bright while there is a digit to read.
   */
  eyeFill: number;
  eyeGlow: number;
  eyeRing: number;
  eyeHot: number;
  digit: Bit | null;
  digitLevel: number;
  /** The rings inside the eye: how brightly they show, and how fast they turn (turns per second). */
  irisLevel: number;
  irisSpeed: number;
  /** A bright arc that runs round the dial: its brightness and where it is, in turns. */
  sweepLevel: number;
  sweepTurn: number;
  /** A ring that closes in on the centre of the eye: its brightness and its size (1 = the full lens). */
  pulseLevel: number;
  pulseScale: number;
  /** The status light. */
  status: number;
  /** Each resonator: how far its cap is on (1 = sealed), its filled glow and its hollow ring. */
  caps: number[];
  resonatorGlow: number[];
  resonatorRing: number[];
  /** Light the eye throws on the machine around it, and on the floor. */
  halo: number;
  /** A flash across the whole eye. */
  flash: number;
}

export function createMachineLook(): MachineLook {
  return {
    hue: 0,
    alarm: 0,
    pointerTurn: 0,
    pointerLevel: 0,
    ports: new Array<number>(PORT_COUNT).fill(0),
    ticks: new Array<number>(TICK_COUNT).fill(0),
    tickShort: new Array<boolean>(TICK_COUNT).fill(false),
    eyeFill: 0,
    eyeGlow: 0,
    eyeRing: 0,
    eyeHot: 0,
    digit: null,
    digitLevel: 0,
    irisLevel: 0,
    irisSpeed: 0,
    sweepLevel: 0,
    sweepTurn: 0,
    pulseLevel: 0,
    pulseScale: 1,
    status: 1,
    caps: new Array<number>(RESONATOR_COUNT).fill(1),
    resonatorGlow: new Array<number>(RESONATOR_COUNT).fill(0),
    resonatorRing: new Array<number>(RESONATOR_COUNT).fill(0),
    halo: 0,
    flash: 0,
  };
}

const FULL_TURN = Math.PI * 2;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Smooth 0 → 1. */
const ease = (t: number): number => {
  const clamped = clamp01(t);
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * The few shapes every animation on the machine is made of, each counted
 * from the moment something happened. With `still` set they collapse to
 * their resting values, so nothing moves.
 */
function shapes(now: number, still: boolean) {
  return {
    /** 0 before the moment, rising smoothly to 1 over `duration`. */
    rise: (at: number, duration: number): number => (still ? (now >= at ? 1 : 0) : ease((now - at) / duration)),
    /** 1 at the moment, falling away to 0 over `duration`. */
    fall: (at: number, duration: number): number => {
      const t = (now - at) / duration;
      return still || t < 0 || t >= 1 ? 0 : (1 - t) * (1 - t);
    },
    /** 0, up to 1, and back to 0, across `duration`. */
    bump: (at: number, duration: number): number => {
      const t = (now - at) / duration;
      return still || t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
    },
    /** A steady swing between 0 and 1. At rest it sits in the middle. */
    swing: (periodMs: number, offset = 0): number => (still ? 0.5 : 0.5 + 0.5 * Math.sin((now / periodMs + offset) * FULL_TURN)),
    /** An unsteady flicker between 0 and 1, different for each `seed`. */
    flicker: (seed: number): number =>
      still ? 0.5 : 0.5 + 0.27 * Math.sin(now * 0.0131 + seed * 2.1) + 0.23 * Math.sin(now * 0.0073 + seed * 5.3),
  };
}

/** Distance between two dial positions, in turns, going the shorter way round. */
const dialDistance = (a: number, b: number): number => Math.abs(shortestTurn(a, b));

/** Works out every light on the machine at the moment `now`, writing into `look`. */
export function computeLook(state: MachineState, now: number, look: MachineLook): MachineLook {
  if (state.mode === 'quantum') {
    quantumLook(state, now, look);
  } else {
    classicalLook(state, now, look);
  }
  restingLook(state, now, look);
  return look;
}

/** How long the machine's lights take to go out when it is put to rest, and to come back when it is woken. */
const REST_MS = 900;

/**
 * At rest every light on the machine is out, whatever it was showing, and the
 * status light is turned down: it is powered, and that is all. The caps on
 * the resonators are hardware, not light, and stay as they are.
 */
function restingLook(state: MachineState, now: number, look: MachineLook): void {
  const changed = shapes(now, state.still).rise(state.restingAt, REST_MS);
  const power = state.resting ? 1 - changed : changed;
  if (power >= 1) {
    return;
  }
  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    look.ticks[tick] = (look.ticks[tick] ?? 0) * power;
  }
  for (let bit = 0; bit < PORT_COUNT; bit += 1) {
    look.ports[bit] = (look.ports[bit] ?? 0) * power;
  }
  for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
    look.resonatorGlow[resonator] = (look.resonatorGlow[resonator] ?? 0) * power;
    look.resonatorRing[resonator] = (look.resonatorRing[resonator] ?? 0) * power;
  }
  look.pointerLevel *= power;
  look.eyeFill *= power;
  look.eyeGlow *= power;
  look.eyeRing *= power;
  look.eyeHot *= power;
  look.digitLevel *= power;
  look.irisLevel *= power;
  look.sweepLevel *= power;
  look.pulseLevel *= power;
  look.halo *= power;
  look.flash *= power;
  look.alarm *= power;
  look.status *= 0.5 + 0.5 * power;
}

function classicalLook(state: MachineState, now: number, look: MachineLook): void {
  const { rise, fall, bump, swing } = shapes(now, state.still);
  const index = dialIndex(state.input);
  const turn = tickTurn(index);

  look.hue = 0;
  look.alarm = 0;
  look.pointerTurn = turn;
  look.pointerLevel = 1;
  look.flash = 0;
  look.sweepLevel = 0;
  look.sweepTurn = turn;
  look.pulseLevel = 0;
  look.pulseScale = 1;
  look.digit = null;
  look.digitLevel = 0;
  look.eyeFill = 0;
  look.eyeRing = 0;
  look.eyeHot = 0;

  // The dial keeps the record: a tick is lit for every input that has been asked — full for a 1, short for a 0.
  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    const answer = state.record[tick] ?? null;
    look.ticks[tick] = answer === null ? 0 : answer === 1 ? 0.95 : 0.62;
    look.tickShort[tick] = answer === 0;
  }

  // The ports mirror the input: a bit set to 1 is a lit port, and the bit just changed flashes.
  for (let bit = 0; bit < PORT_COUNT; bit += 1) {
    const set = state.input[bit] === '1' ? 0.85 : 0;
    const changed = state.changedBit === null || state.changedBit === bit ? fall(state.inputAt, 280) : 0;
    look.ports[bit] = clamp01(set + 0.6 * changed);
  }

  if (state.working) {
    const elapsed = now - state.workingAt;
    const progress = clamp01(elapsed / ORACLE_TIMING.processingMs);

    // The input is drawn in from the ports, a scan runs twice round the dial and comes to rest on the
    // input's own tick, the rings in the eye spin up, and the eye fills as the answer forms.
    for (let bit = 0; bit < PORT_COUNT; bit += 1) {
      look.ports[bit] = (look.ports[bit] ?? 0) * (0.5 + 0.5 * swing(190, -bit / PORT_COUNT));
    }
    look.eyeGlow = state.still ? 0.4 : 0.1 + 0.5 * ease(progress);
    look.eyeHot = state.still ? 0.3 : 0.15 + 0.6 * progress;
    look.irisLevel = state.still ? 0.6 : 0.9;
    look.irisSpeed = state.still ? 0 : 0.25 + 1.1 * progress;
    look.sweepLevel = state.still ? 0 : 1;
    look.sweepTurn = state.still ? turn : turn + 2 * ease(progress);
    const beat = (elapsed % ORACLE_TIMING.irisPulseMs) / ORACLE_TIMING.irisPulseMs;
    look.pulseLevel = state.still || progress >= 1 ? 0 : 0.7 * (1 - beat);
    look.pulseScale = state.still ? 1 : 1 - 0.62 * beat * beat;
    look.status = state.still ? 1 : swing(220) > 0.5 ? 1 : 0.2;
    look.halo = 0.2 + 0.25 * progress;
  } else {
    const blip = fall(state.inputAt, 220);
    look.irisLevel = 0.22;
    look.irisSpeed = state.still ? 0 : 0.012;
    look.status = 0.45 + 0.55 * swing(3600);

    if (state.shown === null) {
      // Nothing is known about this input. The eye is dark, and barely breathing.
      look.eyeGlow = 0.04 + 0.03 * swing(4200) + 0.05 * blip;
      look.halo = 0.08;
    } else {
      // A 1 fills the eye with light; a 0 is a ring of light round an empty centre. The answer just given
      // is bright. The same answer met again later, from the record, is the same shape, dimmer.
      const one = state.shown === 1;
      const arrival = fall(state.answeredAt, 420);
      const recalled = bump(state.recalledAt, 520);
      look.digit = state.shown;
      look.eyeGlow = 0.06 + 0.04 * blip;
      if (state.fresh) {
        look.digitLevel = 1;
        look.eyeFill = one ? 0.36 : 0;
        look.eyeRing = one ? 0 : 0.85;
        look.halo = one ? 0.36 : 0.24;
        look.flash = arrival;
      } else {
        look.digitLevel = 0.55 + 0.45 * recalled;
        look.eyeFill = one ? 0.16 + 0.14 * recalled : 0;
        look.eyeRing = one ? 0 : 0.4 + 0.35 * recalled;
        look.halo = (one ? 0.17 : 0.12) + 0.08 * recalled;
      }
    }

    // Asked about an input already on record: its tick blinks twice. Nothing else stirs — no query was used.
    const sinceRecall = now - state.recalledAt;
    if (!state.still && sinceRecall >= 0 && sinceRecall < 540 && Math.floor(sinceRecall / 135) % 2 === 0) {
      look.ticks[index] = 1;
    }
  }

  // The resonators are capped until the constraint is disclosed. Uncapped, they are dark glass with a trace of light.
  for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
    const open = state.sealed ? 0 : rise(state.unsealedAt + resonator * 110, 520);
    look.caps[resonator] = 1 - open;
    look.resonatorGlow[resonator] = 0;
    look.resonatorRing[resonator] = 0.12 * open;
  }

  standingLook(state, now, look);
}

/**
 * The machine's response to a conclusion being put on record, or to the
 * evidence changing how one stands. It says how the conclusion stands
 * against the record — never whether it is right, which nothing here knows.
 */
function standingLook(state: MachineState, now: number, look: MachineLook): void {
  const age = now - state.standingAt;
  if (state.standing === null || age < 0 || age > 1600) {
    return;
  }
  const { bump } = shapes(now, state.still);

  switch (state.standing) {
    case 'established': {
      // The record settles it: one band of light runs once round the whole dial, and the eye answers.
      if (state.still) {
        if (age < 600) {
          for (let tick = 0; tick < TICK_COUNT; tick += 1) {
            look.ticks[tick] = Math.max(look.ticks[tick] ?? 0, 0.45);
          }
        }
        break;
      }
      const front = age / 900;
      if (front < 1.15) {
        for (let tick = 0; tick < TICK_COUNT; tick += 1) {
          const distance = dialDistance(tickTurn(tick), front % 1) * TICK_COUNT;
          look.ticks[tick] = Math.max(look.ticks[tick] ?? 0, 0.95 * Math.exp(-(distance * distance) / 14));
        }
      }
      look.eyeRing += 0.4 * bump(state.standingAt, 1100);
      look.halo += 0.16 * bump(state.standingAt, 1100);
      break;
    }
    case 'not-established': {
      // The record does not settle it: a faint ripple passes through the ticks that are still unlit —
      // the inputs nobody has asked about.
      for (let tick = 0; tick < TICK_COUNT; tick += 1) {
        if ((state.record[tick] ?? null) === null) {
          const ripple = state.still ? (age < 600 ? 1 : 0) : bump(state.standingAt + tick * 11, 620);
          look.ticks[tick] = Math.max(look.ticks[tick] ?? 0, 0.2 * ripple);
        }
      }
      break;
    }
    case 'contradicted': {
      // The record says otherwise: the eye and the status light turn to the warning colour, twice, briefly.
      const warning = state.still ? age < 600 : age < 640 && Math.floor(age / 160) % 2 === 0;
      if (warning) {
        look.alarm = 1;
        look.eyeGlow = Math.max(look.eyeGlow, 0.45);
        look.halo = Math.max(look.halo, 0.3);
        look.status = 1;
      }
      break;
    }
  }
}

/**
 * Quantum Mode. Until the measurement, everything shown here follows from
 * the stage the run has reached and from nothing else: every tick and every
 * resonator of the six is treated alike, so the machine cannot give away
 * what it is about to read. Only the measurement tells the six apart.
 */
function quantumLook(state: MachineState, now: number, look: MachineLook): void {
  const { rise, fall, swing, flicker } = shapes(now, state.still);
  const at = (stage: number): number => state.stageAt[stage] ?? NOT_YET;
  const reached = (stage: number): boolean => state.stage >= stage;
  const measured = reached(STAGE.measured) ? state.measured : null;

  look.hue = 1;
  look.alarm = 0;
  look.digit = null;
  look.digitLevel = 0;
  look.eyeFill = 0;
  look.eyeRing = 0;
  look.ports.fill(0);
  look.caps.fill(0);
  look.tickShort.fill(false);

  // --- The six resonators of the input, and the spare one ---
  for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
    const spare = resonator === SPARE_RESONATOR;
    let ring = 0.14;
    let glow = 0;

    if (reached(STAGE.prepared)) {
      // Prepared: each holds a definite 0 — a ring of light, and nothing in it.
      ring = 0.14 + 0.46 * rise(at(STAGE.prepared) + resonator * 70, 320);
    }
    if (!spare && reached(STAGE.superposed)) {
      // Superposed: no longer one thing or the other — the ring and the filled light together, never quite still.
      const arrive = rise(at(STAGE.superposed) + resonator * 60, 420);
      glow = arrive * (0.52 + 0.26 * (2 * swing(1400, resonator * 0.27) - 1));
    }
    if (spare && reached(STAGE.spareReady)) {
      // The spare is set against the other six: it swings the opposite way.
      const arrive = rise(at(STAGE.spareReady), 420);
      ring = 0.6 + 0.3 * arrive;
      glow = arrive * (0.46 - 0.24 * (2 * swing(1400) - 1));
    }
    if (reached(STAGE.queried)) {
      glow += 0.3 * fall(at(STAGE.queried), 520);
    }
    if (!spare && reached(STAGE.interfered) && !reached(STAGE.measured)) {
      // Interference: the six are unsettled, and unreadable.
      const unsettled = rise(at(STAGE.interfered), 300);
      glow = glow * (1 - unsettled) + unsettled * (0.3 + 0.5 * flicker(resonator));
    }
    if (!spare && measured !== null) {
      // Measured: each of the six is now one thing — lit for a 1, an empty ring for a 0.
      const settle = rise(at(STAGE.measured), 220);
      const one = measured[resonator] === '1';
      glow = glow * (1 - settle) + settle * (one ? 1 : 0);
      ring = one ? 0.3 : 0.7;
    }
    // The spare is never measured. It goes on as it was.

    look.resonatorRing[resonator] = clamp01(ring);
    look.resonatorGlow[resonator] = clamp01(glow);
  }

  // --- The dial: every input at once ---
  const measuredIndex = measured === null ? -1 : dialIndex(measured);
  const present = reached(STAGE.superposed) ? rise(at(STAGE.superposed), 600) : 0;
  const struck = reached(STAGE.queried) ? fall(at(STAGE.queried), 600) : 0;
  const drained = reached(STAGE.interfered) ? rise(at(STAGE.interfered), 900) : 0;
  const settled = measured === null ? 0 : rise(at(STAGE.measured), 180);
  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    const turn = tickTurn(tick);
    // Superposed: all sixty-four are lit alike, with a slow shimmer passing round them.
    let level = present * (0.42 + (state.still ? 0 : 0.1 * Math.sin((turn * 3 - now / 2400) * FULL_TURN)));
    // The one query touches all of them in the same instant.
    level += 0.5 * struck;
    if (drained > 0) {
      // Interference: two ripples run round the dial against each other while the light drains out of it.
      const ripple = state.still ? 0.5 : 0.5 + 0.5 * Math.cos((turn * 4 - now / 520) * FULL_TURN) * Math.cos((turn * 4 + now / 740) * FULL_TURN);
      level = level * (1 - drained) + (1 - drained) * 0.3 * ripple + 0.05 * drained;
    }
    if (settled > 0) {
      level = level * (1 - settled) + settled * (tick === measuredIndex ? 1 : 0.03);
    }
    look.ticks[tick] = clamp01(level);
  }

  // The pointer has nowhere to point until there is one reading to point at.
  look.pointerTurn = measuredIndex < 0 ? 0 : tickTurn(measuredIndex);
  look.pointerLevel = settled;

  // --- The eye ---
  const breathing = 0.14 + 0.04 * swing(4200);
  let glow = breathing;
  let hot = 0;
  let irisLevel = 0.25;
  let irisSpeed = 0.012;
  if (reached(STAGE.prepared)) {
    glow = 0.2;
    irisLevel = 0.4;
    irisSpeed = 0.05;
  }
  if (reached(STAGE.superposed)) {
    glow = 0.2 + 0.24 * present;
    hot = 0.5 * present;
    irisLevel = 0.7;
    irisSpeed = 0.18;
  }
  if (reached(STAGE.queried)) {
    glow += 0.5 * struck;
    hot += 0.4 * struck;
    irisLevel = 0.9;
    irisSpeed = 0.5;
  }
  if (reached(STAGE.interfered)) {
    glow = glow * (1 - drained) + drained * (0.3 + 0.08 * (2 * swing(260) - 1));
    irisSpeed = 0.8;
  }
  if (measured !== null) {
    glow = glow * (1 - settled) + settled * 0.46;
    hot = hot * (1 - settled) + settled * 0.35;
    irisLevel = 0.35;
    irisSpeed = 0;
  }
  look.eyeGlow = clamp01(glow);
  look.eyeHot = clamp01(hot);
  look.irisLevel = irisLevel;
  look.irisSpeed = state.still ? 0 : irisSpeed;

  // The query is one sweep, once round the dial.
  const sinceQuery = now - at(STAGE.queried);
  const sweeping = !state.still && reached(STAGE.queried) && sinceQuery >= 0 && sinceQuery < 440;
  look.sweepLevel = sweeping ? 1 : 0;
  look.sweepTurn = sweeping ? sinceQuery / 440 : 0;

  // A ring closes on the centre of the eye when the run is prepared, and again when it is measured.
  const closing = Math.max(fall(at(STAGE.prepared), 520), measured === null ? 0 : fall(at(STAGE.measured), 520));
  look.pulseLevel = 0.7 * closing;
  look.pulseScale = 0.38 + 0.62 * closing;

  look.flash = Math.max(struck > 0 ? fall(at(STAGE.queried), 380) : 0, measured === null ? 0 : 0.8 * fall(at(STAGE.measured), 420));
  look.status = reached(STAGE.prepared) && !reached(STAGE.measured) ? 1 : 0.45 + 0.55 * swing(3600);
  look.halo = clamp01(0.12 + 0.2 * present + 0.3 * struck + 0.1 * settled);
}
