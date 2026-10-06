import { ORACLE_INPUT_LENGTH } from '../config/oracleConfig';

/**
 * Where everything on the machine is, in design units, measured from the
 * top-left corner of its body. Plain numbers and arithmetic, so the drawing
 * code, the live parts and the tests all work from the same plan.
 *
 * The machine is one instrument built around one eye:
 *
 *   lens      the smoked glass the answer appears behind
 *   dial      a ring of ticks, one for every input the machine can be given
 *   track     the groove the dial's pointer runs in
 *   flange    the collar that carries the resonators
 *   ports     where the composed input enters, one per bit
 */
export const MACHINE = {
  width: 480,
  height: 300,
  /** Depth of the cut across each corner of the body. */
  corner: 14,
  /** Room around the body inside its texture: the shadow it throws, and the base it stands on. */
  margin: { x: 80, top: 64, bottom: 104 },

  /** Centre of the eye. It sits a little above the middle of the body, leaving a chin for the ports. */
  eye: { x: 240, y: 142 },
  lensRadius: 58,
  chamfer: { inner: 58, outer: 66 },
  dial: { inner: 66, outer: 90, tickInner: 72, tickOuter: 84 },
  track: { inner: 90, outer: 96, radius: 93 },
  flange: { inner: 96, outer: 122 },
  resonators: { orbit: 109, radius: 8, collar: 11.5 },

  ports: { y: 280, width: 18, height: 5, gap: 8 },
  wings: { inset: 16, top: 18, width: 86, height: 264 },
  statusLight: { x: 437, y: 37, radius: 2.5 },

  /** The base the body stands on: a short neck, then a foot. */
  base: { neckTop: 126, neckBottom: 104, neckHeight: 14, footWidth: 216, footHeight: 13 },
} as const;

/** One tick on the dial for every possible input. */
export const TICK_COUNT = 2 ** ORACLE_INPUT_LENGTH;
/** One port for every bit of the input. */
export const PORT_COUNT = ORACLE_INPUT_LENGTH;
/** One resonator for every bit of the input, and one more that belongs to no bit. */
export const RESONATOR_COUNT = ORACLE_INPUT_LENGTH + 1;
/** The resonator that belongs to no bit of the input. */
export const SPARE_RESONATOR = ORACLE_INPUT_LENGTH;

const FULL_TURN = Math.PI * 2;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point at an angle (radians, clockwise from the right) and a distance from the centre of the eye. */
export function aroundEye(angle: number, radius: number): Point {
  return { x: MACHINE.eye.x + Math.cos(angle) * radius, y: MACHINE.eye.y + Math.sin(angle) * radius };
}

/** A position on the dial, in turns (0 = straight up, increasing clockwise), as an angle in radians. */
export function turnToAngle(turn: number): number {
  return (turn - 0.25) * FULL_TURN;
}

/** Where on the dial an input index sits, in turns. Index 0 is at the top; the indices run clockwise. */
export function tickTurn(index: number): number {
  return index / TICK_COUNT;
}

/** The angle of the tick for an input index, in radians. */
export function tickAngle(index: number): number {
  return turnToAngle(tickTurn(index));
}

/** The dial index of a binary input, leftmost bit most significant — the same order the input space is listed in. */
export function dialIndex(input: string): number {
  const index = Number.parseInt(input, 2);
  return Number.isInteger(index) && index >= 0 && index < TICK_COUNT ? index : 0;
}

/**
 * The shorter way round from one dial position to another, in turns: between
 * −0.5 and +0.5. The pointer follows this, so it never takes the long way.
 */
export function shortestTurn(from: number, to: number): number {
  const difference = (((to - from) % 1) + 1.5) % 1;
  return difference - 0.5;
}

/**
 * The angle of a resonator. The spare one is at the top. The six that belong
 * to the bits follow one another round the eye from there: down the left
 * side, across the bottom and up the right. So the first three bits are on
 * the left, the last three on the right, and each bit faces its opposite
 * number (first and last, second and fifth, third and fourth) across the eye.
 */
export function resonatorAngle(resonator: number): number {
  const step = FULL_TURN / RESONATOR_COUNT;
  const top = -Math.PI / 2;
  return resonator === SPARE_RESONATOR ? top : top - (resonator + 1) * step;
}

export function resonatorPosition(resonator: number): Point {
  return aroundEye(resonatorAngle(resonator), MACHINE.resonators.orbit);
}

/** Centre of the port for a bit of the input. The ports are in the order of the bits, left to right. */
export function portPosition(bit: number): Point {
  const { width, gap, y } = MACHINE.ports;
  const pitch = width + gap;
  const rowWidth = PORT_COUNT * width + (PORT_COUNT - 1) * gap;
  return { x: MACHINE.eye.x - rowWidth / 2 + width / 2 + bit * pitch, y };
}
