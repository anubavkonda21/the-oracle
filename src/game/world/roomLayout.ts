import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/display';
import { MACHINE_CENTER_Y } from '../config/oracleConfig';
import { MACHINE } from '../entities/oracleMachineLayout';
import { createSeededRandom } from '../../utils/random';

/**
 * The plan of the laboratory, in design units. The painter (roomTextures.ts),
 * the live room (RoomScene) and the tests all read the same plan, so a lamp
 * is always drawn on the piece of equipment it belongs to.
 *
 * The room is seen square-on: a back wall, and a floor running from the foot
 * of that wall toward the viewer. Three depths:
 *
 *   back    the wall and what stands against it — a bay for the machine,
 *           two instrument racks, a gas panel, an electrical cabinet, and a
 *           cable tray overhead that ties them together
 *   middle  the machine on its dais, the pump and the cryostat that serve
 *           it, and two pieces of floor equipment further out
 *   front   dark, out-of-focus shapes at the edges of the frame
 *
 * Everything here is in the room for a reason: it serves the machine (the
 * cooling and pumping line, the dais), it is how such a machine would be
 * driven and read (racks, the instrument cart), or it is what a room like
 * this is made of (the wall, the tray, the cabinet).
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where the machine stands: the centre of its body. */
export const MACHINE_AT = { x: DESIGN_WIDTH / 2, y: MACHINE_CENTER_Y } as const;

/** The space the machine's body takes up in the room. Nothing else may be drawn into it. */
export const MACHINE_BOUNDS: Rect = {
  x: MACHINE_AT.x - MACHINE.width / 2,
  y: MACHINE_AT.y - MACHINE.height / 2,
  width: MACHINE.width,
  height: MACHINE.height,
};

/** Where the machine's foot meets what it stands on. */
export const MACHINE_FOOT_Y = MACHINE_BOUNDS.y + MACHINE.height + MACHINE.base.neckHeight + MACHINE.base.footHeight - 1;

export const ROOM = {
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  /** Where the back wall meets the floor. */
  floorLine: 492,
  /** The point the floor's lines run to: the viewer's eye level, straight ahead. */
  vanishing: { x: DESIGN_WIDTH / 2, y: 404 },
  /** The ceiling's edge, with the light fittings set into it. */
  soffit: 46,
  /** The cable tray that runs the width of the room. */
  tray: { y: 82, height: 20 },
  /** The shallow recess in the wall that the machine stands in front of. */
  bay: { x: 436, y: 118, width: 568, height: 374 },

  /** The work light over the machine, and the two fittings that light the rest of the room. */
  fixtures: {
    key: { x: 520, y: 24, width: 400, height: 13 },
    fillLeft: { x: 150, y: 28, width: 180, height: 11 },
    fillRight: { x: 1110, y: 28, width: 180, height: 11 },
  },

  rackA: { x: 148, y: 146, width: 172, height: 346 },
  rackB: { x: 1120, y: 146, width: 172, height: 346 },
  gasPanel: { x: 22, y: 176, width: 96, height: 300 },
  cabinet: { x: 1322, y: 206, width: 96, height: 232 },
  /** The pump, to the machine's left, and the hose that joins it to the machine. */
  pump: { x: 356, y: 318, width: 86, height: 174 },
  /** The cryostat, to the machine's right, hung in its frame. */
  cryostat: { x: 990, y: 150, width: 92, height: 342 },
  /** The box of controls at the cryostat's foot. */
  cryostatControls: { x: 1000, y: 456, width: 72, height: 34 },

  /** The dais the machine stands on: a low platform, seen from a little above. */
  dais: { backY: 505, frontY: 540, faceBottom: 556, backLeft: 496, backRight: 944, frontLeft: 462, frontRight: 978 },

  compressor: { x: 108, y: 580, width: 224, height: 150 },
  cart: { x: 1150, y: 556, width: 196, height: 176 },
} as const;

/** What a unit in a rack is. Each is drawn differently, and carries different lamps. */
export type RackUnitKind = 'vent' | 'source' | 'patch' | 'meter' | 'scope' | 'supply' | 'blank';

export interface RackUnit {
  readonly kind: RackUnitKind;
  /** Height of the unit, in design units. */
  readonly height: number;
}

/** The left rack drives the machine: signal sources, patching, power. */
export const RACK_A_UNITS: readonly RackUnit[] = [
  { kind: 'blank', height: 22 },
  { kind: 'source', height: 44 },
  { kind: 'source', height: 44 },
  { kind: 'patch', height: 52 },
  { kind: 'meter', height: 34 },
  { kind: 'vent', height: 40 },
  { kind: 'supply', height: 46 },
  { kind: 'blank', height: 22 },
];

/** The right rack reads it: a scope, level meters, amplifiers behind patching. */
export const RACK_B_UNITS: readonly RackUnit[] = [
  { kind: 'blank', height: 22 },
  { kind: 'scope', height: 70 },
  { kind: 'meter', height: 34 },
  { kind: 'patch', height: 52 },
  { kind: 'source', height: 44 },
  { kind: 'vent', height: 40 },
  { kind: 'supply', height: 46 },
];

/** Space between the frame of a rack and the units in it. */
export const RACK_INSET = { x: 12, top: 12, gap: 3 } as const;

/** The face of each unit in a rack, top to bottom. */
export function rackUnitRects(rack: Rect, units: readonly RackUnit[]): Rect[] {
  const rects: Rect[] = [];
  let y = rack.y + RACK_INSET.top;
  for (const unit of units) {
    rects.push({ x: rack.x + RACK_INSET.x, y, width: rack.width - RACK_INSET.x * 2, height: unit.height });
    y += unit.height + RACK_INSET.gap;
  }
  return rects;
}

/** Which lamps a light belongs to — they come on, and go off, together. */
export type LampGroup = 'standby' | 'active' | 'subsystem';

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly group: LampGroup;
  /** Red marks power and warnings; everything else is the instrument white. */
  readonly red: boolean;
  /** Size of the lamp's glow, relative to an ordinary indicator. */
  readonly size: number;
  /** An activity lamp ticks on and off; `period` is one tick in milliseconds and `offset` where in the tick it starts (0–1). */
  readonly period: number;
  readonly offset: number;
}

/** A lit screen: where it is, and which of the painted screens it shows. */
export interface Screen {
  readonly rect: Rect;
  readonly kind: 'trace' | 'readout' | 'spectrum';
}

/** Where on a unit's face its lamps sit. The painter draws an unlit lens at each of the same places. */
export function unitLampSpots(unit: RackUnit, face: Rect): { x: number; y: number; group: LampGroup; red: boolean; ticks: boolean }[] {
  const midY = face.y + face.height / 2;
  const right = face.x + face.width;
  switch (unit.kind) {
    case 'source':
      return [
        { x: right - 12, y: face.y + 11, group: 'standby', red: true, ticks: false },
        { x: right - 12, y: face.y + 23, group: 'active', red: false, ticks: true },
        { x: right - 24, y: face.y + 23, group: 'active', red: false, ticks: false },
      ];
    case 'meter':
      return Array.from({ length: 8 }, (_, step) => ({
        x: face.x + 46 + step * 11,
        y: midY,
        group: 'active' as const,
        red: step >= 6,
        ticks: step >= 4,
      }));
    case 'scope':
      return [
        { x: right - 14, y: face.y + 14, group: 'standby', red: true, ticks: false },
        { x: right - 14, y: face.y + 28, group: 'active', red: false, ticks: true },
      ];
    case 'supply':
      return [
        { x: face.x + 18, y: midY, group: 'standby', red: true, ticks: false },
        { x: face.x + 32, y: midY, group: 'active', red: false, ticks: false },
      ];
    case 'patch':
      return [{ x: right - 10, y: face.y + 9, group: 'active', red: false, ticks: true }];
    case 'vent':
    case 'blank':
      return [];
  }
}

/** The screen on a unit's face, if it has one. */
export function unitScreen(unit: RackUnit, face: Rect): Screen | null {
  if (unit.kind === 'source') {
    return { rect: { x: face.x + 10, y: face.y + 9, width: 44, height: 14 }, kind: 'readout' };
  }
  if (unit.kind === 'scope') {
    return { rect: { x: face.x + 10, y: face.y + 9, width: 78, height: 52 }, kind: 'trace' };
  }
  return null;
}

/** The screen of the instrument on the cart. */
export const CART_SCREEN: Screen = {
  rect: { x: ROOM.cart.x + 18, y: ROOM.cart.y + 16, width: 74, height: 46 },
  kind: 'spectrum',
};

function buildLamps(): Lamp[] {
  // The same lamps tick the same way on every load.
  const random = createSeededRandom(19);
  const lamps: Lamp[] = [];
  const add = (x: number, y: number, group: LampGroup, red = false, ticks = false, size = 1): void => {
    lamps.push({ x, y, group, red, size, period: ticks ? 700 + Math.round(random() * 1900) : 0, offset: random() });
  };

  for (const [rack, units] of [
    [ROOM.rackA, RACK_A_UNITS],
    [ROOM.rackB, RACK_B_UNITS],
  ] as const) {
    const faces = rackUnitRects(rack, units);
    units.forEach((unit, index) => {
      const face = faces[index];
      if (!face) {
        return;
      }
      for (const spot of unitLampSpots(unit, face)) {
        add(spot.x, spot.y, spot.group, spot.red, spot.ticks);
      }
    });
  }

  // The gas panel and the cabinet: one lamp each to say they have power.
  add(ROOM.gasPanel.x + ROOM.gasPanel.width - 14, ROOM.gasPanel.y + 16, 'standby', true);
  add(ROOM.cabinet.x + 16, ROOM.cabinet.y + 18, 'standby', true);

  // The pump runs whenever the room is in use.
  add(ROOM.pump.x + ROOM.pump.width / 2, ROOM.pump.y + ROOM.pump.height - 22, 'active', false, true);

  // The cooling line: three lamps on the cryostat's controls, one at each of its two stages,
  // and four set into the edge of the dais. Dark until the constraint is disclosed.
  const controls = ROOM.cryostatControls;
  for (let lamp = 0; lamp < 3; lamp += 1) {
    add(controls.x + 14 + lamp * 14, controls.y + 12, 'subsystem', false, lamp === 2);
  }
  const cryostatX = ROOM.cryostat.x + ROOM.cryostat.width / 2;
  add(cryostatX, ROOM.cryostat.y + 78, 'subsystem');
  add(cryostatX, ROOM.cryostat.y + 132, 'subsystem');
  const { dais } = ROOM;
  for (let lamp = 0; lamp < 4; lamp += 1) {
    const along = (lamp + 0.5) / 4;
    add(dais.frontLeft + 60 + along * (dais.frontRight - dais.frontLeft - 120), dais.frontY + 8, 'subsystem', false, false, 1.25);
  }

  // The instrument on the cart.
  add(ROOM.cart.x + ROOM.cart.width - 26, ROOM.cart.y + 24, 'standby', true);
  add(ROOM.cart.x + ROOM.cart.width - 26, ROOM.cart.y + 40, 'active', false, true);

  return lamps;
}

/** Every indicator lamp in the room. */
export const LAMPS: readonly Lamp[] = buildLamps();

function buildScreens(): Screen[] {
  const screens: Screen[] = [];
  for (const [rack, units] of [
    [ROOM.rackA, RACK_A_UNITS],
    [ROOM.rackB, RACK_B_UNITS],
  ] as const) {
    const faces = rackUnitRects(rack, units);
    units.forEach((unit, index) => {
      const face = faces[index];
      const screen = face ? unitScreen(unit, face) : null;
      if (screen) {
        screens.push(screen);
      }
    });
  }
  screens.push(CART_SCREEN);
  return screens;
}

/** Every lit screen in the room. */
export const SCREENS: readonly Screen[] = buildScreens();

/**
 * How bright a lamp is at the moment `now`, between 0 and 1, before its
 * group's level is applied. A steady lamp is simply on. An activity lamp
 * ticks — faster the busier the room is — and, with `still` set, holds steady.
 */
export function lampLevel(lamp: Lamp, now: number, activity: number, still = false): number {
  if (lamp.period === 0 || still) {
    return 1;
  }
  const period = lamp.period / (1 + 3 * Math.min(1, Math.max(0, activity)));
  const beat = (now / period + lamp.offset) % 1;
  return beat < 0.5 ? 1 : 0.22;
}

/**
 * How many full-frame layers the room blends over what is beneath them: the
 * light, laid over the painted room, and the frame of foreground shapes over
 * everything. The painted room itself is solid, and is not counted. The
 * budget is four on a phone and six on a desktop.
 */
export const FULL_FRAME_BLENDED_LAYERS = 2;
