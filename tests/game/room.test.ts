import { describe, expect, it } from 'vitest';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/game/config/display';
import { MACHINE } from '../../src/game/entities/oracleMachineLayout';
import {
  LIGHTING_STATES,
  LIGHT_CHANNELS,
  LIGHT_PRESETS,
  createLightRig,
  isSettling,
  levelsAt,
  levelsFor,
  setLighting,
  setWorking,
  timingFor,
  whileWorking,
  type LightingState,
} from '../../src/game/world/lightRig';
import {
  FULL_FRAME_BLENDED_LAYERS,
  LAMPS,
  MACHINE_AT,
  MACHINE_BOUNDS,
  MACHINE_FOOT_Y,
  RACK_A_UNITS,
  RACK_B_UNITS,
  RACK_INSET,
  ROOM,
  SCREENS,
  lampLevel,
  rackUnitRects,
  unitLampSpots,
  type Rect,
} from '../../src/game/world/roomLayout';
import shellCss from '../../src/styles/shell.css?raw';

/**
 * The laboratory: the plan of the room, and its lighting. Both are plain
 * numbers, tested here without a canvas. (The painting of the room — in
 * roomTextures.ts — and the scene that lights it are checked by eye, in a
 * browser.)
 */

const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const codeOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return entry[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
};

/** Long enough for any change of light to have finished. */
const SETTLED = 10_000;

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const contains = (outer: Rect, x: number, y: number, slack = 0): boolean =>
  x >= outer.x - slack && x <= outer.x + outer.width + slack && y >= outer.y - slack && y <= outer.y + outer.height + slack;

describe('the light: what each state of the room looks like', () => {
  it('names every state the room can be in', () => {
    expect([...LIGHTING_STATES].sort()).toEqual(Object.keys(LIGHT_PRESETS).sort());
    expect(LIGHTING_STATES).toHaveLength(6);
  });

  it('keeps every level a level: between nothing and full', () => {
    for (const state of LIGHTING_STATES) {
      for (const working of [false, true]) {
        const levels = levelsFor(state, working);
        for (const channel of LIGHT_CHANNELS) {
          expect(levels[channel]).toBeGreaterThanOrEqual(0);
          // The machine's own light may be carried further than it would reach unaided; nothing else goes past full.
          expect(levels[channel]).toBeLessThanOrEqual(channel === 'spill' ? 2 : 1);
        }
      }
    }
  });

  it('never lets the room go blacker than the page it sits in, nor lighter than a dark room', () => {
    for (const state of LIGHTING_STATES) {
      expect(LIGHT_PRESETS[state].ambient).toBeGreaterThanOrEqual(0.15);
      expect(LIGHT_PRESETS[state].ambient).toBeLessThanOrEqual(0.3);
    }
  });

  it('dormant: the work light is out, nothing is in use, and only the standby lamps are lit', () => {
    const { dormant } = LIGHT_PRESETS;
    expect(dormant.key).toBe(0);
    expect(dormant.active).toBe(0);
    expect(dormant.subsystem).toBe(0);
    expect(dormant.fill).toBeLessThan(0.1);
    expect(dormant.standby).toBeGreaterThan(0);
  });

  it('classical: clean work light on the machine, the room lit, the equipment in use', () => {
    const { classical, dormant } = LIGHT_PRESETS;
    expect(classical.key).toBeGreaterThan(0.6);
    expect(classical.fill).toBeGreaterThan(dormant.fill * 4);
    expect(classical.active).toBe(1);
    expect(classical.onMachine).toBe(1);
    expect(classical.subsystem).toBe(0);
  });

  it('constraint: the same work light drawn in, and the cooling line come on', () => {
    const { classical, constraint } = LIGHT_PRESETS;
    expect(constraint.subsystem).toBe(1);
    expect(constraint.fill).toBeLessThan(classical.fill);
    expect(constraint.key).toBeLessThanOrEqual(classical.key);
    expect(constraint.key).toBeGreaterThan(classical.key * 0.8);
    expect(constraint.active).toBe(classical.active);
  });

  it('quantum: the room goes dark, and the machine’s own light carries furthest', () => {
    const { quantum, classical } = LIGHT_PRESETS;
    expect(quantum.key).toBeLessThan(0.1);
    expect(quantum.fill).toBeLessThan(0.1);
    expect(quantum.onMachine).toBeLessThan(classical.onMachine / 2);
    expect(quantum.subsystem).toBe(1);
    for (const state of LIGHTING_STATES) {
      expect(quantum.spill).toBeGreaterThanOrEqual(LIGHT_PRESETS[state].spill);
    }
  });

  it('revealed: every light in the room is up — brighter than at any other time', () => {
    const { revealed } = LIGHT_PRESETS;
    for (const state of LIGHTING_STATES) {
      expect(revealed.key).toBeGreaterThanOrEqual(LIGHT_PRESETS[state].key);
      expect(revealed.fill).toBeGreaterThanOrEqual(LIGHT_PRESETS[state].fill);
      expect(revealed.ambient).toBeGreaterThanOrEqual(LIGHT_PRESETS[state].ambient);
    }
    expect(revealed.key).toBe(1);
    expect(revealed.fill).toBeGreaterThan(LIGHT_PRESETS.classical.fill * 1.5);
  });

  it('power-down: it ends in the dark, with less lit than when the room is merely dormant', () => {
    const down = LIGHT_PRESETS['power-down'];
    expect(down.key).toBe(0);
    expect(down.active).toBe(0);
    expect(down.subsystem).toBe(0);
    expect(down.standby).toBeLessThan(LIGHT_PRESETS.dormant.standby);
    expect(down.fill).toBeLessThanOrEqual(LIGHT_PRESETS.dormant.fill);
  });

  it('shows the quantum light in Quantum Mode, and in no other state', () => {
    for (const state of LIGHTING_STATES) {
      expect(LIGHT_PRESETS[state].quantum).toBe(state === 'quantum' ? 1 : 0);
      expect(whileWorking(LIGHT_PRESETS[state]).quantum).toBe(LIGHT_PRESETS[state].quantum);
    }
  });

  it('tells every state from every other by its light alone', () => {
    for (const first of LIGHTING_STATES) {
      for (const second of LIGHTING_STATES) {
        if (first === second) {
          continue;
        }
        const difference = Math.max(
          ...(['key', 'fill', 'subsystem', 'quantum', 'active'] as const).map((channel) =>
            Math.abs(LIGHT_PRESETS[first][channel] - LIGHT_PRESETS[second][channel]),
          ),
        );
        // Dormant and power-down are both the dark; every other pair differs plainly.
        const bothDark = [first, second].every((state) => state === 'dormant' || state === 'power-down');
        expect(difference, `${first} / ${second}`).toBeGreaterThanOrEqual(bothDark ? 0 : 0.14);
      }
    }
  });
});

describe('the light: the machine at work', () => {
  it('draws the room’s light away and holds it on the machine', () => {
    for (const state of ['classical', 'constraint'] as const) {
      const idle = levelsFor(state);
      const working = levelsFor(state, true);
      expect(working.fill).toBeLessThan(idle.fill / 2);
      expect(working.key).toBeGreaterThanOrEqual(idle.key);
      expect(working.haze).toBeGreaterThan(idle.haze);
      expect(working.activity).toBe(1);
      expect(working.onMachine).toBe(idle.onMachine);
    }
  });

  it('leaves on whatever the state had on: the cooling line stays lit through a question', () => {
    expect(levelsFor('constraint', true).subsystem).toBe(1);
    expect(levelsFor('classical', true).subsystem).toBe(0);
    expect(levelsFor('constraint', true).active).toBe(1);
  });

  it('is felt at once, and lets go a little more slowly', () => {
    const rig = createLightRig('classical');
    const idle = levelsAt(rig, 0);

    setWorking(rig, true, 1000);
    expect(levelsAt(rig, 1000).fill).toBeCloseTo(idle.fill, 9); // No jump at the moment it starts.
    expect(levelsAt(rig, 1200).fill).toBeCloseTo(levelsFor('classical', true).fill, 9);
    expect(isSettling(rig, 1100)).toBe(true);
    expect(isSettling(rig, 1250)).toBe(false);

    setWorking(rig, false, 2000);
    expect(levelsAt(rig, 2200).fill).toBeLessThan(idle.fill);
    expect(levelsAt(rig, 2500).fill).toBeCloseTo(idle.fill, 9);
  });

  it('does nothing when told what is already so', () => {
    const rig = createLightRig('classical');
    setWorking(rig, false, 500);
    expect(rig.changedAt).toBe(Number.NEGATIVE_INFINITY);
    setWorking(rig, true, 600);
    setWorking(rig, true, 900);
    expect(rig.changedAt).toBe(600);
  });

  it('carries on working across a change of state, and stops when told', () => {
    const rig = createLightRig('classical');
    setWorking(rig, true, 0);
    setLighting(rig, 'constraint', 100);
    expect(levelsAt(rig, 100 + SETTLED)).toEqual(levelsFor('constraint', true));
    setWorking(rig, false, 20_000);
    expect(levelsAt(rig, 20_000 + SETTLED)).toEqual(levelsFor('constraint'));
  });
});

describe('the light: getting from one state to another', () => {
  it('arrives exactly at the state asked for, from anywhere', () => {
    for (const from of LIGHTING_STATES) {
      for (const to of LIGHTING_STATES) {
        const rig = createLightRig(from);
        setLighting(rig, to, 1000);
        expect(levelsAt(rig, 1000 + SETTLED)).toEqual(levelsFor(to));
        expect(isSettling(rig, 1000 + SETTLED)).toBe(false);
      }
    }
  });

  it('never jumps: at the moment of a change every light is where it was', () => {
    const rig = createLightRig('dormant');
    const order: LightingState[] = ['classical', 'constraint', 'quantum', 'revealed', 'power-down', 'dormant', 'quantum', 'classical'];
    let now = 0;
    for (const state of order) {
      // Changes arrive at awkward moments — part-way through the one before.
      now += 430;
      const before = levelsAt(rig, now);
      setLighting(rig, state, now);
      const after = levelsAt(rig, now);
      for (const channel of LIGHT_CHANNELS) {
        expect(after[channel]).toBeCloseTo(before[channel], 9);
      }
    }
  });

  it('moves each light steadily toward where it is going, without overshooting', () => {
    for (const [from, to] of [
      ['dormant', 'classical'],
      ['classical', 'quantum'],
      ['quantum', 'revealed'],
      ['revealed', 'power-down'],
    ] as const) {
      const rig = createLightRig(from);
      setLighting(rig, to, 0);
      const start = levelsFor(from);
      const end = levelsFor(to);
      let last = levelsAt(rig, 0);
      for (let now = 40; now <= 4000; now += 40) {
        const levels = levelsAt(rig, now);
        for (const channel of LIGHT_CHANNELS) {
          const rising = end[channel] >= start[channel];
          expect(rising ? levels[channel] >= last[channel] - 1e-12 : levels[channel] <= last[channel] + 1e-12).toBe(true);
          expect(levels[channel]).toBeGreaterThanOrEqual(Math.min(start[channel], end[channel]) - 1e-12);
          expect(levels[channel]).toBeLessThanOrEqual(Math.max(start[channel], end[channel]) + 1e-12);
        }
        last = levels;
      }
    }
  });

  it('brings the room up bank by bank: its general light first, the work light last', () => {
    const rig = createLightRig('dormant');
    setLighting(rig, 'classical', 0);
    const early = levelsAt(rig, 300);
    expect(early.fill).toBeGreaterThan(LIGHT_PRESETS.dormant.fill);
    expect(early.key).toBe(0);
    expect(early.standby).toBe(1);
    const timing = timingFor('classical');
    expect(timing.key.delay).toBeGreaterThan(timing.fill.delay);
  });

  it('enters Quantum Mode by losing the work light first, and only then turning to the quantum light', () => {
    const rig = createLightRig('classical');
    setLighting(rig, 'quantum', 0);
    const early = levelsAt(rig, 400);
    expect(early.key).toBeLessThan(LIGHT_PRESETS.classical.key / 2 + 0.1);
    expect(early.quantum).toBe(0);
    expect(levelsAt(rig, 900).quantum).toBeGreaterThan(0);
    expect(levelsAt(rig, 900).key).toBeLessThan(0.1);
  });

  it('shuts down in order: the work light, then the room, then the lamps on the equipment', () => {
    const rig = createLightRig('revealed');
    setLighting(rig, 'power-down', 0);
    const afterKey = levelsAt(rig, 620);
    expect(afterKey.key).toBe(0);
    expect(afterKey.fill).toBeGreaterThan(0.5);
    expect(afterKey.active).toBe(1);
    const afterRoom = levelsAt(rig, 1900);
    expect(afterRoom.fill).toBeCloseTo(LIGHT_PRESETS['power-down'].fill, 9);
    expect(afterRoom.active).toBe(0);
    expect(afterRoom.standby).toBe(1);
    expect(levelsAt(rig, 2900).standby).toBeCloseTo(LIGHT_PRESETS['power-down'].standby, 9);
  });

  it('takes a second or two, never long enough to be waited for', () => {
    for (const state of LIGHTING_STATES) {
      const longest = Math.max(...LIGHT_CHANNELS.map((channel) => timingFor(state)[channel].delay + timingFor(state)[channel].duration));
      expect(longest).toBeGreaterThanOrEqual(600);
      expect(longest).toBeLessThanOrEqual(3000);
    }
  });

  it('is simply there under reduced motion', () => {
    const rig = createLightRig('classical');
    setLighting(rig, 'quantum', 1000, true);
    expect(levelsAt(rig, 1000, true)).toEqual(levelsFor('quantum'));
    expect(levelsAt(rig, 1001, true)).toEqual(levelsFor('quantum'));
    setWorking(rig, true, 2000, true);
    expect(levelsAt(rig, 2000, true)).toEqual(levelsFor('quantum', true));
  });

  it('does nothing when asked for the state it is already in', () => {
    const rig = createLightRig('classical');
    setLighting(rig, 'classical', 700);
    expect(rig.changedAt).toBe(Number.NEGATIVE_INFINITY);
    expect(isSettling(rig, 700)).toBe(false);
  });
});

describe('the plan of the room', () => {
  const againstTheWall: Rect[] = [ROOM.rackA, ROOM.rackB, ROOM.gasPanel, ROOM.cabinet, ROOM.pump, ROOM.cryostat];
  const onTheFloor: Rect[] = [ROOM.compressor, ROOM.cart];
  const frame: Rect = { x: 0, y: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT };

  it('puts the machine where the laboratory has always had it, and leaves that space to it alone', () => {
    expect(MACHINE_AT).toEqual({ x: 720, y: 340 });
    expect(MACHINE_BOUNDS).toEqual({ x: 480, y: 190, width: MACHINE.width, height: MACHINE.height });
    for (const rect of [...againstTheWall, ...onTheFloor, ROOM.cryostatControls]) {
      expect(overlap(rect, MACHINE_BOUNDS)).toBe(false);
    }
  });

  it('stands the machine in its bay, in front of the wall', () => {
    const { bay, floorLine } = ROOM;
    expect(bay.x).toBeLessThan(MACHINE_BOUNDS.x);
    expect(bay.x + bay.width).toBeGreaterThan(MACHINE_BOUNDS.x + MACHINE_BOUNDS.width);
    expect(bay.y).toBeLessThan(MACHINE_BOUNDS.y);
    expect(bay.y + bay.height).toBe(floorLine);
    // The bay is centred on the machine.
    expect(bay.x + bay.width / 2).toBe(MACHINE_AT.x);
    // It stands on the floor, forward of the wall.
    expect(MACHINE_FOOT_Y).toBeGreaterThan(floorLine);
  });

  it('sets the machine’s foot on the dais, with dais to spare on every side', () => {
    const { dais } = ROOM;
    expect(MACHINE_FOOT_Y).toBeGreaterThan(dais.backY);
    expect(MACHINE_FOOT_Y).toBeLessThan(dais.frontY);
    const footLeft = MACHINE_AT.x - MACHINE.base.footWidth / 2;
    const footRight = MACHINE_AT.x + MACHINE.base.footWidth / 2;
    expect(dais.backLeft).toBeLessThan(footLeft - 60);
    expect(dais.backRight).toBeGreaterThan(footRight + 60);
    // Seen from a little above, the near edge of the dais is the wider and the lower.
    expect(dais.frontLeft).toBeLessThan(dais.backLeft);
    expect(dais.frontRight).toBeGreaterThan(dais.backRight);
    expect(dais.frontY).toBeGreaterThan(dais.backY);
    expect((dais.frontLeft + dais.frontRight) / 2).toBe(MACHINE_AT.x);
  });

  it('keeps everything inside the picture', () => {
    for (const rect of [...againstTheWall, ...onTheFloor, ROOM.bay, ...Object.values(ROOM.fixtures)]) {
      expect(rect.x).toBeGreaterThanOrEqual(frame.x);
      expect(rect.y).toBeGreaterThanOrEqual(frame.y);
      expect(rect.x + rect.width).toBeLessThanOrEqual(frame.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(frame.height);
    }
  });

  it('stands what is against the wall on the floor line, and what is on the floor forward of it', () => {
    for (const rect of [ROOM.rackA, ROOM.rackB, ROOM.pump, ROOM.cryostat]) {
      expect(rect.y + rect.height).toBe(ROOM.floorLine);
    }
    for (const rect of onTheFloor) {
      expect(rect.y).toBeGreaterThan(ROOM.floorLine);
    }
  });

  it('lets nothing in the room stand in front of anything else at the same depth', () => {
    for (const group of [againstTheWall, onTheFloor]) {
      group.forEach((first, index) => {
        for (const second of group.slice(index + 1)) {
          expect(overlap(first, second)).toBe(false);
        }
      });
    }
  });

  it('is laid out evenly about the machine: a rack either side, the pump on one hand and the cryostat on the other', () => {
    expect(ROOM.rackA.x + ROOM.rackA.width / 2 + ROOM.rackB.x + ROOM.rackB.width / 2).toBe(DESIGN_WIDTH);
    expect(ROOM.rackA.width).toBe(ROOM.rackB.width);
    expect(ROOM.pump.x + ROOM.pump.width).toBeLessThan(MACHINE_BOUNDS.x);
    expect(ROOM.cryostat.x).toBeGreaterThan(MACHINE_BOUNDS.x + MACHINE_BOUNDS.width);
    // Both are close enough for a hose to reach.
    expect(MACHINE_BOUNDS.x - (ROOM.pump.x + ROOM.pump.width)).toBeLessThan(60);
    expect(ROOM.cryostat.x - (MACHINE_BOUNDS.x + MACHINE_BOUNDS.width)).toBeLessThan(60);
  });

  it('hangs the cable tray and the light fittings above everything else', () => {
    const lowestOverhead = ROOM.tray.y + ROOM.tray.height;
    for (const rect of againstTheWall) {
      expect(rect.y).toBeGreaterThan(lowestOverhead);
    }
    expect(ROOM.bay.y).toBeGreaterThan(lowestOverhead);
    for (const fixture of Object.values(ROOM.fixtures)) {
      expect(fixture.y + fixture.height).toBeLessThan(ROOM.soffit);
    }
    // The work light is over the machine.
    expect(ROOM.fixtures.key.x + ROOM.fixtures.key.width / 2).toBe(MACHINE_AT.x);
  });

  it('fits the units of each rack inside its frame', () => {
    for (const [rack, units] of [
      [ROOM.rackA, RACK_A_UNITS],
      [ROOM.rackB, RACK_B_UNITS],
    ] as const) {
      const faces = rackUnitRects(rack, units);
      expect(faces).toHaveLength(units.length);
      faces.forEach((face, index) => {
        expect(face.x).toBe(rack.x + RACK_INSET.x);
        expect(face.x + face.width).toBe(rack.x + rack.width - RACK_INSET.x);
        expect(face.y + face.height).toBeLessThanOrEqual(rack.y + rack.height - 4);
        const next = faces[index + 1];
        if (next) {
          expect(next.y).toBe(face.y + face.height + RACK_INSET.gap);
        }
      });
    }
  });
});

describe('the lamps and screens', () => {
  const equipment: Rect[] = [ROOM.rackA, ROOM.rackB, ROOM.gasPanel, ROOM.cabinet, ROOM.pump, ROOM.cryostat, ROOM.cryostatControls, ROOM.cart];
  const daisFace: Rect = {
    x: ROOM.dais.frontLeft,
    y: ROOM.dais.frontY,
    width: ROOM.dais.frontRight - ROOM.dais.frontLeft,
    height: ROOM.dais.faceBottom - ROOM.dais.frontY,
  };

  it('puts every lamp on a piece of equipment, and none on the machine', () => {
    expect(LAMPS.length).toBeGreaterThan(30);
    for (const lamp of LAMPS) {
      expect([...equipment, daisFace].some((rect) => contains(rect, lamp.x, lamp.y))).toBe(true);
      expect(contains(MACHINE_BOUNDS, lamp.x, lamp.y)).toBe(false);
    }
  });

  it('puts each rack unit’s lamps on that unit’s own face', () => {
    for (const [rack, units] of [
      [ROOM.rackA, RACK_A_UNITS],
      [ROOM.rackB, RACK_B_UNITS],
    ] as const) {
      const faces = rackUnitRects(rack, units);
      units.forEach((unit, index) => {
        const face = faces[index];
        if (!face) {
          throw new Error('A unit has no face.');
        }
        for (const spot of unitLampSpots(unit, face)) {
          expect(contains(face, spot.x, spot.y)).toBe(true);
        }
      });
    }
  });

  it('has lamps of all three kinds: those that never go out, those of equipment in use, and the cooling line’s', () => {
    for (const group of ['standby', 'active', 'subsystem'] as const) {
      expect(LAMPS.filter((lamp) => lamp.group === group).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the cooling line’s lamps where the cooling line is: on the cryostat, its controls, and the dais', () => {
    const coolingLine: Rect[] = [ROOM.cryostat, ROOM.cryostatControls, daisFace];
    for (const lamp of LAMPS.filter((candidate) => candidate.group === 'subsystem')) {
      expect(coolingLine.some((rect) => contains(rect, lamp.x, lamp.y))).toBe(true);
      expect(lamp.red).toBe(false);
    }
  });

  it('uses red sparingly: for power and for warnings', () => {
    const red = LAMPS.filter((lamp) => lamp.red);
    expect(red.length).toBeGreaterThan(0);
    expect(red.length).toBeLessThan(LAMPS.length / 3);
  });

  it('is the same room on every load', () => {
    // The lamps' ticking is laid out from a fixed seed, so it does not depend on when or where the game runs.
    const first = LAMPS[0];
    const ticking = LAMPS.filter((lamp) => lamp.period > 0);
    expect(first).toBeDefined();
    expect(ticking.length).toBeGreaterThan(5);
    for (const lamp of ticking) {
      expect(lamp.period).toBeGreaterThanOrEqual(700);
      expect(lamp.period).toBeLessThanOrEqual(2600);
    }
    expect(new Set(ticking.map((lamp) => lamp.period)).size).toBeGreaterThan(ticking.length / 2);
  });

  it('leaves a steady lamp steady, and ticks an activity lamp — faster when the room is busy', () => {
    const steady = LAMPS.find((lamp) => lamp.period === 0);
    const ticking = LAMPS.find((lamp) => lamp.period > 0);
    if (!steady || !ticking) {
      throw new Error('The room should have both kinds of lamp.');
    }
    const flips = (activity: number): number => {
      let count = 0;
      let last = lampLevel(ticking, 0, activity);
      for (let now = 10; now <= 20_000; now += 10) {
        const level = lampLevel(ticking, now, activity);
        if (level !== last) {
          count += 1;
        }
        last = level;
      }
      return count;
    };
    for (const now of [0, 333, 5000]) {
      expect(lampLevel(steady, now, 1)).toBe(1);
    }
    expect(flips(0)).toBeGreaterThan(4);
    expect(flips(1)).toBeGreaterThan(flips(0) * 3);
    // A ticking lamp dims; it never goes fully out.
    expect(Math.min(...Array.from({ length: 300 }, (_, step) => lampLevel(ticking, step * 37, 0.5)))).toBeGreaterThan(0);
  });

  it('holds every lamp steady under reduced motion', () => {
    for (const lamp of LAMPS) {
      for (const now of [0, 411, 9000]) {
        expect(lampLevel(lamp, now, 1, true)).toBe(1);
      }
    }
  });

  it('sets every screen into the equipment it belongs to', () => {
    expect(SCREENS.length).toBeGreaterThanOrEqual(4);
    for (const screen of SCREENS) {
      const { rect } = screen;
      expect(equipment.some((owner) => contains(owner, rect.x, rect.y) && contains(owner, rect.x + rect.width, rect.y + rect.height))).toBe(true);
    }
  });
});

describe('the room is one room, there throughout', () => {
  const room = codeOf('/scenes/RoomScene.ts');
  const stageScenes = ['/scenes/MainMenuScene.ts', '/scenes/LaboratoryScene.ts', '/scenes/QuantumScene.ts', '/scenes/RevealScene.ts', '/scenes/CreditsScene.ts'];

  it('is started once, when the game has loaded, beneath every scene the player moves through', () => {
    const preload = codeOf('/scenes/PreloadScene.ts');
    expect(preload.match(/this\.scene\.launch\(SCENE_KEYS\.room\)/g)).toHaveLength(1);
    expect(preload.indexOf('this.scene.launch(SCENE_KEYS.room)')).toBeLessThan(preload.indexOf('this.scene.start(SCENE_KEYS.mainMenu)'));
    // Painted before it is started.
    expect(preload.indexOf('createRoomTextures(')).toBeLessThan(preload.indexOf('this.scene.launch(SCENE_KEYS.room)'));

    const order = /scene: \[([^\]]*)\]/.exec(codeOf('/config/gameConfig.ts'))?.[1]?.split(',').map((name) => name.trim()) ?? [];
    expect(order).toEqual(['BootScene', 'PreloadScene', 'RoomScene', 'MainMenuScene', 'LaboratoryScene', 'QuantumScene', 'RevealScene', 'CreditsScene']);
  });

  it('is never stopped or restarted by any scene', () => {
    for (const file of [...stageScenes, '/scenes/RoomScene.ts', '/scenes/StageScene.ts', '/scenes/PreloadScene.ts']) {
      expect(codeOf(file)).not.toMatch(/scene\.(stop|start|restart|sleep|pause|remove)\(SCENE_KEYS\.room/);
    }
  });

  it('holds the one machine: no other scene makes a machine, or draws anything on the canvas of its own', () => {
    expect(room.match(/new OracleMachine\(/g)).toHaveLength(1);
    for (const file of stageScenes) {
      const code = codeOf(file);
      expect(code).not.toMatch(/new OracleMachine\(/);
      expect(code).not.toMatch(/this\.add\./);
    }
  });

  it('is told its state by each scene, and decides nothing itself', () => {
    const told = (file: string): string[] => [...codeOf(file).matchAll(/room\.light\('([a-z-]+)'\)/g)].map((match) => match[1] ?? '');
    expect(told('/scenes/MainMenuScene.ts')).toEqual(['dormant']);
    expect(told('/scenes/LaboratoryScene.ts')).toEqual(['classical', 'constraint']);
    expect(told('/scenes/QuantumScene.ts')).toEqual(['quantum']);
    expect(told('/scenes/RevealScene.ts')).toEqual(['revealed']);
    expect(told('/scenes/CreditsScene.ts')).toEqual(['power-down']);

    // The room knows nothing of the investigation, the oracle or the quantum engine.
    const imports = [...room.matchAll(/from\s+'([^']+)';/g)].map((match) => match[1] ?? '');
    expect(imports.length).toBeGreaterThan(5);
    for (const path of imports) {
      expect(path).not.toMatch(/systems|quantum|ui\//);
    }
    for (const file of ['/world/lightRig.ts', '/world/roomLayout.ts', '/world/roomTextures.ts']) {
      expect(codeOf(file)).not.toMatch(/from\s+'[^']*(systems|quantum|scenes|ui)\//);
    }
  });

  it('dims the room for exactly as long as the machine is working', () => {
    const laboratory = codeOf('/scenes/LaboratoryScene.ts');
    expect(laboratory).toMatch(/this\.machine\.startProcessing\(\);\s*this\.room\.work\(true\);/);
    expect(laboratory).toMatch(/this\.machine\.showAnswer\(query\.output\);\s*this\.room\.work\(false\);/);
    // And a new visit never inherits a room still dimmed from the last.
    expect(laboratory).toMatch(/this\.room\.work\(false\);\s*this\.room\.light\('classical'\);/);
    expect(codeOf('/scenes/QuantumScene.ts')).toMatch(/room\.work\(false\);\s*room\.light\('quantum'\);/);
  });

  it('puts the machine to rest wherever nobody is working at it, and wakes it where they are', () => {
    for (const file of ['/scenes/MainMenuScene.ts', '/scenes/RevealScene.ts', '/scenes/CreditsScene.ts']) {
      expect(codeOf(file)).toMatch(/room\.machine\.rest\(\);/);
    }
    expect(codeOf('/scenes/LaboratoryScene.ts')).toMatch(/this\.machine\.begin\('classical'\);/);
    expect(codeOf('/scenes/QuantumScene.ts')).toMatch(/this\.machine\.begin\('quantum'\);/);
    expect(room).toMatch(/this\.theMachine\.rest\(false\);/);
  });

  it('stays in view between scenes: only the interface fades', () => {
    const css = shellCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const hidden = /\.stage\[data-visibility='hidden'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(hidden).not.toMatch(/opacity/);
    expect(css).toMatch(/\.stage\[data-visibility='hidden'\] \.stage__ui\s*\{\s*opacity:\s*0;\s*\}/);
    expect(/^\.stage\s*\{([^}]*)\}/m.exec(css)?.[1] ?? 'opacity').not.toMatch(/opacity|transition/);
    expect(/^\.stage__ui\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '').toMatch(/transition:\s*opacity var\(--motion-scene-fade\)/);
  });

  it('takes its quantum light from the rig alone, and has none painted into it', () => {
    expect(room.match(/'quantum(Indigo|Bright)'/g)).toEqual(["'quantumBright'"]);
    expect(room).toMatch(/mixColor\(colorNumber\('instrument'\), colorNumber\('quantumBright'\), levels\.quantum\)/);
    expect(codeOf('/world/roomTextures.ts')).not.toMatch(/quantum/i);
    expect(codeOf('/world/roomLayout.ts')).not.toMatch(/quantum/i);
  });

  it('keeps within the budget for layers blended over the whole frame', () => {
    // A phone is allowed four and a desktop six. The room uses the same few everywhere.
    expect(FULL_FRAME_BLENDED_LAYERS).toBeLessThanOrEqual(4);
    // Counted in the scene itself: three things cover the frame — the painted room, which is solid, and two that blend.
    expect(room.match(/\.setDisplaySize\(DESIGN_WIDTH, DESIGN_HEIGHT\)/g)).toHaveLength(FULL_FRAME_BLENDED_LAYERS + 1);
    expect(room.match(/\.setBlendMode\(MULTIPLY\)/g)).toHaveLength(1);
    // No pass over the whole frame after the fact: no filters, no post-processing.
    expect(room).not.toMatch(/postFX|preFX|setPostPipeline|addBlur|addBloom|filter/i);
  });

  it('paints the room no larger than it needs to be, and its light much smaller', () => {
    const painter = codeOf('/world/roomTextures.ts');
    expect(painter).toMatch(/export const MAX_ROOM_SCALE = 2;/);
    expect(painter).toMatch(/const scale = Math\.min\(resolution, MAX_ROOM_SCALE\);/);
    expect(painter).toMatch(/export const LIGHT_SCALE = 1 \/ 3;/);
    // Nothing is downloaded: every texture is made in code.
    expect(painter).not.toMatch(/\.load\.|new Image\(|\.png|\.jpg|\.webp|fetch\(/);
  });
});
