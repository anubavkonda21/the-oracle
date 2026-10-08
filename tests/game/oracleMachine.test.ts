import { describe, expect, it } from 'vitest';
import { ORACLE_INPUT_LENGTH, ORACLE_TIMING } from '../../src/game/config/oracleConfig';
import {
  MACHINE,
  PORT_COUNT,
  RESONATOR_COUNT,
  SPARE_RESONATOR,
  TICK_COUNT,
  aroundEye,
  dialIndex,
  portPosition,
  resonatorAngle,
  resonatorPosition,
  shortestTurn,
  tickAngle,
  tickTurn,
} from '../../src/game/entities/oracleMachineLayout';
import {
  QUANTUM_STAGES,
  beginRun,
  computeLook,
  createMachineLook,
  createMachineState,
  reachStage,
  recall,
  resetMachine,
  restoreRecord,
  setAnswer,
  setInput,
  setResting,
  setStanding,
  startWorking,
  unseal,
  type MachineLook,
  type MachineState,
} from '../../src/game/entities/oracleMachineModel';
import { inputAt, inputIndex, inputSpaceSize } from '../../src/game/systems/oracle/inputSpace';
import { runDeutschJozsa } from '../../src/quantum/deutschJozsa';
import { createConstantFunction, createParityFunction } from '../../src/quantum/booleanFunction';
import { createOracle } from '../../src/quantum/oracle';

/**
 * The machine as it is drawn: where its parts are, and what it shows for
 * what it has been told. All of it is plain arithmetic, tested here without
 * a canvas. (The drawing itself — oracleMachineTextures.ts and the Phaser
 * class — is checked by eye, in a browser.)
 */

const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return entry[1];
};
const codeOf = (fileName: string): string => sourceOf(fileName).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** A moment long after anything that has happened: every arrival is over, and only what is steady remains. */
const LATER = 60_000;

const lookAt = (state: MachineState, now: number): MachineLook => computeLook(state, now, createMachineLook());
/** A copy that will not change when the same look object is filled in again. */
const snapshot = (look: MachineLook): MachineLook => JSON.parse(JSON.stringify(look)) as MachineLook;

/** A classical machine that has been asked `input` and has answered `output`, at time 0. */
function answered(input: string, output: 0 | 1): MachineState {
  const state = createMachineState('classical');
  setInput(state, input, null, 0);
  startWorking(state, 0);
  setAnswer(state, output, 0, true);
  setInput(state, input, output, 0); // The laboratory redraws the input once the answer is in.
  return state;
}

describe('the machine’s layout', () => {
  it('has a tick for every input, a port for every bit, and one resonator more than there are bits', () => {
    expect(TICK_COUNT).toBe(inputSpaceSize(ORACLE_INPUT_LENGTH));
    expect(TICK_COUNT).toBe(64);
    expect(PORT_COUNT).toBe(ORACLE_INPUT_LENGTH);
    expect(RESONATOR_COUNT).toBe(ORACLE_INPUT_LENGTH + 1);
    expect(SPARE_RESONATOR).toBe(ORACLE_INPUT_LENGTH);
  });

  it('orders the dial as the input space is ordered: leftmost bit most significant', () => {
    for (let index = 0; index < TICK_COUNT; index += 1) {
      const input = inputAt(index, ORACLE_INPUT_LENGTH);
      expect(dialIndex(input)).toBe(inputIndex(input));
      expect(dialIndex(input)).toBe(index);
    }
  });

  it('sends anything that is not an input to the top of the dial rather than off it', () => {
    for (const nonsense of ['', 'abc', '2', '1111111']) {
      expect(dialIndex(nonsense)).toBe(0);
    }
  });

  it('puts input 0 at the top and runs clockwise', () => {
    const top = aroundEye(tickAngle(0), 10);
    const right = aroundEye(tickAngle(TICK_COUNT / 4), 10);
    const bottom = aroundEye(tickAngle(TICK_COUNT / 2), 10);

    expect(top.x).toBeCloseTo(MACHINE.eye.x, 9);
    expect(top.y).toBeCloseTo(MACHINE.eye.y - 10, 9);
    expect(right.x).toBeCloseTo(MACHINE.eye.x + 10, 9);
    expect(bottom.y).toBeCloseTo(MACHINE.eye.y + 10, 9);
    expect(tickTurn(TICK_COUNT / 2)).toBe(0.5);
  });

  it('turns the pointer the shorter way round, never more than half a turn', () => {
    expect(shortestTurn(0.9, 0.1)).toBeCloseTo(0.2, 9);
    expect(shortestTurn(0.1, 0.9)).toBeCloseTo(-0.2, 9);
    expect(shortestTurn(0.25, 0.25)).toBeCloseTo(0, 9);
    for (let from = 0; from < TICK_COUNT; from += 1) {
      for (let to = 0; to < TICK_COUNT; to += 1) {
        const turn = shortestTurn(tickTurn(from), tickTurn(to));
        expect(Math.abs(turn)).toBeLessThanOrEqual(0.5);
        // Going that far from `from` arrives at `to`.
        expect(Math.abs(shortestTurn(tickTurn(from) + turn, tickTurn(to)))).toBeLessThan(1e-9);
      }
    }
  });

  it('nests the parts of the eye inside one another, and the whole eye inside the body', () => {
    const { lensRadius, chamfer, dial, track, flange, eye, width, height } = MACHINE;

    expect(chamfer.inner).toBe(lensRadius);
    expect(dial.inner).toBe(chamfer.outer);
    expect(track.inner).toBe(dial.outer);
    expect(flange.inner).toBe(track.outer);
    expect(dial.tickInner).toBeGreaterThan(dial.inner);
    expect(dial.tickOuter).toBeLessThan(dial.outer);
    expect(track.radius).toBeGreaterThan(track.inner);
    expect(track.radius).toBeLessThan(track.outer);

    expect(eye.x).toBe(width / 2);
    expect(eye.y - flange.outer).toBeGreaterThan(0);
    expect(eye.y + flange.outer).toBeLessThan(height);
    expect(eye.x - flange.outer).toBeGreaterThan(MACHINE.wings.inset + MACHINE.wings.width);
  });

  it('seats seven resonators on the flange, evenly spaced, with the spare one at the top', () => {
    const { flange, resonators, eye } = MACHINE;
    expect(resonators.orbit - resonators.collar).toBeGreaterThanOrEqual(flange.inner);
    expect(resonators.orbit + resonators.collar).toBeLessThanOrEqual(flange.outer);

    const spare = resonatorPosition(SPARE_RESONATOR);
    expect(spare.x).toBeCloseTo(eye.x, 9);
    expect(spare.y).toBeCloseTo(eye.y - resonators.orbit, 9);

    const angles = Array.from({ length: RESONATOR_COUNT }, (_, resonator) => {
      const turn = resonatorAngle(resonator) / (Math.PI * 2);
      return turn - Math.floor(turn);
    }).sort((a, b) => a - b);
    for (let index = 1; index < angles.length; index += 1) {
      expect((angles[index] ?? 0) - (angles[index - 1] ?? 0)).toBeCloseTo(1 / RESONATOR_COUNT, 9);
    }
  });

  it('sets the six resonators of the input round the eye in the order of the bits: three on the left, three on the right', () => {
    const step = (Math.PI * 2) / RESONATOR_COUNT;
    // From the spare one at the top, each bit is one place further round, down the left side and up the right.
    for (let bit = 0; bit < ORACLE_INPUT_LENGTH; bit += 1) {
      expect(resonatorAngle(bit)).toBeCloseTo(resonatorAngle(SPARE_RESONATOR) - (bit + 1) * step, 9);
      const side = resonatorPosition(bit).x - MACHINE.eye.x;
      expect(side < 0).toBe(bit < ORACLE_INPUT_LENGTH / 2);
    }
    // Each bit faces its opposite number across the eye.
    for (let bit = 0; bit < ORACLE_INPUT_LENGTH / 2; bit += 1) {
      const left = resonatorPosition(bit);
      const right = resonatorPosition(ORACLE_INPUT_LENGTH - 1 - bit);
      expect(left.x + right.x).toBeCloseTo(MACHINE.eye.x * 2, 9);
      expect(left.y).toBeCloseTo(right.y, 9);
    }
  });

  it('sets the ports in a row in the chin, left to right in the order of the bits, clear of the eye', () => {
    const ports = Array.from({ length: PORT_COUNT }, (_, bit) => portPosition(bit));
    for (let bit = 1; bit < ports.length; bit += 1) {
      expect((ports[bit]?.x ?? 0) - (ports[bit - 1]?.x ?? 0)).toBeCloseTo(MACHINE.ports.width + MACHINE.ports.gap, 9);
    }
    expect((ports[0]?.x ?? 0) + (ports[PORT_COUNT - 1]?.x ?? 0)).toBeCloseTo(MACHINE.eye.x * 2, 9);
    for (const port of ports) {
      expect(port.y - MACHINE.ports.height / 2).toBeGreaterThan(MACHINE.eye.y + MACHINE.flange.outer);
      expect(port.y + MACHINE.ports.height / 2).toBeLessThan(MACHINE.height);
    }
  });
});

describe('the machine in the laboratory', () => {
  it('starts dark: nothing on the dial, nothing in the ports, no answer, every resonator capped', () => {
    const look = lookAt(createMachineState('classical'), LATER);

    expect(look.ticks.every((level) => level === 0)).toBe(true);
    expect(look.ports.every((level) => level === 0)).toBe(true);
    expect(look.digit).toBeNull();
    expect(look.digitLevel).toBe(0);
    expect(look.eyeFill).toBe(0);
    expect(look.eyeRing).toBe(0);
    expect(look.caps.every((cap) => cap === 1)).toBe(true);
    expect(look.resonatorGlow.every((level) => level === 0)).toBe(true);
    expect(look.resonatorRing.every((level) => level === 0)).toBe(true);
    expect(look.eyeGlow).toBeLessThan(0.15); // Powered, and no more.
    expect(look.status).toBeGreaterThan(0);
  });

  it('mirrors the input in its ports: lit for a 1, dark for a 0', () => {
    for (const input of ['000000', '111111', '101101', '010010', '100000', '000001']) {
      const state = createMachineState('classical');
      setInput(state, input, null, 0);
      const look = lookAt(state, LATER);
      for (let bit = 0; bit < PORT_COUNT; bit += 1) {
        if (input[bit] === '1') {
          expect(look.ports[bit]).toBeGreaterThan(0.5);
        } else {
          expect(look.ports[bit]).toBe(0);
        }
      }
    }
  });

  it('answers a bit being set, at once: the port that changed flashes', () => {
    const state = createMachineState('classical');
    setInput(state, '000100', null, 1000);
    expect(state.changedBit).toBe(3);

    const atOnce = lookAt(state, 1010);
    const settled = lookAt(state, 1000 + LATER);
    expect(atOnce.ports[3] ?? 0).toBeGreaterThan(settled.ports[3] ?? 0);
    // A bit turned off flashes too, and then goes dark.
    setInput(state, '000000', null, 5000);
    expect(lookAt(state, 5010).ports[3]).toBeGreaterThan(0.3);
    expect(lookAt(state, 5000 + LATER).ports[3]).toBe(0);
  });

  it('points the dial at the input being composed', () => {
    const state = createMachineState('classical');
    for (let index = 0; index < TICK_COUNT; index += 1) {
      setInput(state, inputAt(index, ORACLE_INPUT_LENGTH), null, index);
      const look = lookAt(state, LATER);
      expect(look.pointerTurn).toBe(index / TICK_COUNT);
      expect(look.pointerLevel).toBe(1);
    }
  });

  it('shows no answer while it is working — whatever the record holds', () => {
    const state = createMachineState('classical');
    setInput(state, '101101', null, 0);
    startWorking(state, 0);
    // The record already holds the query being worked on. The laboratory may redraw the input meanwhile.
    setInput(state, '101101', 1, 100);

    for (const now of [0, 200, 550, ORACLE_TIMING.processingMs - 1, ORACLE_TIMING.processingMs + 5000]) {
      const look = lookAt(state, now);
      expect(look.digit).toBeNull();
      expect(look.digitLevel).toBe(0);
      expect(look.eyeFill).toBe(0);
      expect(look.eyeRing).toBe(0);
    }
    expect(state.shown).toBeNull();
  });

  it('visibly works: the scan runs, the rings turn, the eye fills, the status light quickens', () => {
    const state = createMachineState('classical');
    setInput(state, '000011', null, 0);
    const idle = snapshot(lookAt(state, LATER));
    startWorking(state, LATER);

    const early = snapshot(lookAt(state, LATER + 100));
    const late = snapshot(lookAt(state, LATER + ORACLE_TIMING.processingMs - 100));
    expect(early.sweepLevel).toBe(1);
    expect(idle.sweepLevel).toBe(0);
    expect(early.irisSpeed).toBeGreaterThan(idle.irisSpeed * 10);
    expect(late.irisSpeed).toBeGreaterThan(early.irisSpeed);
    expect(late.eyeGlow).toBeGreaterThan(early.eyeGlow);
    expect(early.eyeGlow).toBeGreaterThan(idle.eyeGlow);
    expect(early.pulseLevel).toBeGreaterThan(0);
  });

  it('brings the scan to rest on the tick of the input it was asked about', () => {
    const state = createMachineState('classical');
    setInput(state, '110000', null, 0);
    startWorking(state, 0);
    const end = lookAt(state, ORACLE_TIMING.processingMs);
    // Two whole turns from where it started: back at the input's own tick.
    expect(end.sweepTurn - tickTurn(dialIndex('110000'))).toBeCloseTo(2, 9);
  });

  it('answers a 1 by filling the eye, and a 0 by ringing it — with the digit in both', () => {
    const one = lookAt(answered('100000', 1), 10);
    expect(one.digit).toBe(1);
    expect(one.digitLevel).toBe(1);
    expect(one.eyeFill).toBeGreaterThan(0.2);
    expect(one.eyeRing).toBe(0);

    const zero = lookAt(answered('000000', 0), 10);
    expect(zero.digit).toBe(0);
    expect(zero.digitLevel).toBe(1);
    expect(zero.eyeRing).toBeGreaterThan(0.5);
    expect(zero.eyeFill).toBe(0);
  });

  it('keeps the eye’s own glare away from a digit that has to be read', () => {
    for (const output of [0, 1] as const) {
      const look = lookAt(answered('010101', output), LATER);
      expect(look.eyeGlow).toBeLessThan(0.15);
      expect(look.eyeHot).toBe(0);
      expect(look.eyeFill).toBeLessThan(0.5);
    }
  });

  it('makes something of an answer arriving, and then lets it be', () => {
    const state = answered('001100', 1);
    expect(lookAt(state, 10).flash).toBeGreaterThan(0.5);
    expect(lookAt(state, LATER).flash).toBe(0);
    // Put back without ceremony — as when the player returns to the laboratory — nothing flashes at all.
    const quiet = createMachineState('classical');
    setInput(quiet, '001100', null, 0);
    setAnswer(quiet, 1, 0, false);
    expect(lookAt(quiet, 10).flash).toBe(0);
    expect(lookAt(quiet, 10).digit).toBe(1);
  });

  it('keeps the record on the dial: a tick lit for every input asked, full for a 1 and short for a 0', () => {
    const state = createMachineState('classical');
    const asked: [string, 0 | 1][] = [
      ['000000', 0],
      ['100000', 1],
      ['000001', 1],
      ['111111', 0],
      ['010101', 0],
    ];
    for (const [input, output] of asked) {
      setInput(state, input, null, 0);
      startWorking(state, 0);
      setAnswer(state, output, 0, true);
    }
    const look = lookAt(state, LATER);

    const lit = look.ticks.map((level, tick) => (level > 0 ? tick : -1)).filter((tick) => tick >= 0);
    expect(lit).toEqual(asked.map(([input]) => dialIndex(input)).sort((a, b) => a - b));
    for (const [input, output] of asked) {
      const tick = dialIndex(input);
      expect(look.tickShort[tick]).toBe(output === 0);
    }
    // A 1 is the brighter of the two.
    expect(look.ticks[dialIndex('100000')] ?? 0).toBeGreaterThan(look.ticks[dialIndex('000000')] ?? 0);
  });

  it('shows the recorded answer again when the player comes back to an input — the same shape, dimmer', () => {
    const state = answered('100000', 1);
    const fresh = snapshot(lookAt(state, LATER));

    setInput(state, '100001', null, LATER); // an input not yet asked
    const elsewhere = snapshot(lookAt(state, LATER * 2));
    expect(elsewhere.digit).toBeNull();
    expect(elsewhere.eyeFill).toBe(0);
    expect(elsewhere.eyeRing).toBe(0);

    setInput(state, '100000', 1, LATER * 2); // back again: the record has it
    const again = snapshot(lookAt(state, LATER * 3));
    expect(again.digit).toBe(1);
    expect(again.digitLevel).toBeLessThan(fresh.digitLevel);
    expect(again.digitLevel).toBeGreaterThan(0.4);
    expect(again.eyeFill).toBeGreaterThan(0);
    expect(again.eyeFill).toBeLessThan(fresh.eyeFill);
    expect(again.eyeRing).toBe(0);
  });

  it('stays as the answer arrived for as long as the answered input is the one composed', () => {
    const state = answered('001000', 0);
    // Cursor moves redraw the input without changing it.
    setInput(state, '001000', 0, 500);
    setInput(state, '001000', 0, 900);
    expect(state.fresh).toBe(true);
    expect(lookAt(state, LATER).digitLevel).toBe(1);
  });

  it('does not set to work when asked about an input already on record: its tick blinks, and that is all', () => {
    const state = answered('100000', 1);
    setInput(state, '000000', null, 100);
    setInput(state, '100000', 1, 200);
    const before = snapshot(lookAt(state, LATER));

    recall(state, LATER);
    const during = snapshot(lookAt(state, LATER + 200));
    expect(state.working).toBe(false);
    expect(during.sweepLevel).toBe(0);
    expect(during.pulseLevel).toBe(0);
    expect(during.irisSpeed).toBe(before.irisSpeed);
    expect(during.digit).toBe(1);
    expect(during.digitLevel).toBeGreaterThan(before.digitLevel);
    // The tick blinks: on, off, on, off.
    const tick = dialIndex('100000');
    expect(lookAt(state, LATER + 50).ticks[tick]).toBe(1);
    expect(lookAt(state, LATER + 200).ticks[tick]).toBe(before.ticks[tick]);
    expect(lookAt(state, LATER + 300).ticks[tick]).toBe(1);

    // And afterwards it is exactly as a machine that was never asked again.
    const untouched = answered('100000', 1);
    setInput(untouched, '000000', null, 100);
    setInput(untouched, '100000', 1, 200);
    expect(snapshot(lookAt(state, LATER * 2))).toEqual(snapshot(lookAt(untouched, LATER * 2)));
  });

  it('puts an existing record back on the dial without answering anything', () => {
    const state = createMachineState('classical');
    restoreRecord(state, [
      { input: '000000', output: 0 },
      { input: '111000', output: 1 },
    ]);
    const look = lookAt(state, 5);

    expect(look.ticks[0]).toBeGreaterThan(0);
    expect(look.ticks[dialIndex('111000')]).toBeGreaterThan(0);
    expect(look.ticks.filter((level) => level > 0)).toHaveLength(2);
    expect(look.flash).toBe(0);
    expect(look.digit).toBeNull();
  });

  it('keeps its resonators capped until the constraint is disclosed, then uncaps them one after another', () => {
    const state = createMachineState('classical');
    expect(lookAt(state, LATER).caps.every((cap) => cap === 1)).toBe(true);

    unseal(state, 1000, true);
    const during = lookAt(state, 1300);
    expect(during.caps[0] ?? 1).toBeLessThan(during.caps[RESONATOR_COUNT - 1] ?? 0);

    const after = lookAt(state, 1000 + LATER);
    expect(after.caps.every((cap) => cap === 0)).toBe(true);
    // Uncapped they are dark glass with a trace of light — nothing is running in them.
    expect(after.resonatorGlow.every((level) => level === 0)).toBe(true);
    expect(after.resonatorRing.every((level) => level > 0 && level < 0.2)).toBe(true);
  });

  it('simply has its resonators uncapped when the player returns to a laboratory that had got that far', () => {
    const state = createMachineState('classical');
    unseal(state, 1000, false);
    expect(lookAt(state, 1001).caps.every((cap) => cap === 0)).toBe(true);
  });

  describe('when the player puts a conclusion on record', () => {
    const withRecord = (): MachineState => {
      const state = answered('100000', 1);
      setInput(state, '000000', null, 0);
      startWorking(state, 0);
      setAnswer(state, 0, 0, false);
      setInput(state, '000000', 0, 0);
      return state;
    };

    it('runs a band of light once round the dial when the record establishes it', () => {
      const state = withRecord();
      const before = snapshot(lookAt(state, LATER));
      setStanding(state, 'established', LATER, true);

      const during = lookAt(state, LATER + 450);
      const brightened = during.ticks.filter((level, tick) => level > (before.ticks[tick] ?? 0) + 0.3).length;
      expect(brightened).toBeGreaterThan(2);
      expect(brightened).toBeLessThan(TICK_COUNT / 2); // A band, not the whole dial.
      expect(during.alarm).toBe(0);

      // Once round, and it is over: the machine is as one that was never told.
      expect(snapshot(lookAt(state, LATER * 2))).toEqual(snapshot(lookAt(withRecord(), LATER * 2)));
    });

    it('ripples through the ticks nobody has asked about when the record leaves it open', () => {
      const state = withRecord();
      const before = snapshot(lookAt(state, LATER));
      setStanding(state, 'not-established', LATER, true);

      let untestedStirred = 0;
      for (let now = LATER; now < LATER + 1400; now += 20) {
        const look = lookAt(state, now);
        for (let tick = 0; tick < TICK_COUNT; tick += 1) {
          if (state.record[tick] !== null) {
            expect(look.ticks[tick]).toBe(before.ticks[tick]); // What is on record does not move.
          } else if ((look.ticks[tick] ?? 0) > 0) {
            untestedStirred += 1;
            expect(look.ticks[tick] ?? 0).toBeLessThanOrEqual(0.2); // Faint: these are not answers.
          }
        }
        expect(look.alarm).toBe(0);
      }
      expect(untestedStirred).toBeGreaterThan(TICK_COUNT);
      expect(snapshot(lookAt(state, LATER * 2))).toEqual(snapshot(lookAt(withRecord(), LATER * 2)));
    });

    it('turns the eye to the warning colour, twice and briefly, when the record contradicts it', () => {
      const state = withRecord();
      const before = snapshot(lookAt(state, LATER));
      setStanding(state, 'contradicted', LATER, true);

      expect(lookAt(state, LATER + 50).alarm).toBe(1);
      expect(lookAt(state, LATER + 200).alarm).toBe(0);
      expect(lookAt(state, LATER + 370).alarm).toBe(1);
      expect(lookAt(state, LATER + 700).alarm).toBe(0);
      // The record itself is not in question: the dial does not change.
      expect(lookAt(state, LATER + 50).ticks).toEqual(before.ticks);
      expect(snapshot(lookAt(state, LATER * 2))).toEqual(snapshot(lookAt(withRecord(), LATER * 2)));
    });

    it('makes nothing of a standing that is merely being redrawn, or of a conclusion withdrawn', () => {
      // Compared, at the same instant, with a machine that was told nothing.
      const untold = snapshot(lookAt(withRecord(), LATER + 100));
      for (const standing of ['established', 'not-established', 'contradicted', null] as const) {
        const state = withRecord();
        setStanding(state, standing, LATER, false);
        expect(snapshot(lookAt(state, LATER + 100))).toEqual(untold);
      }
      const state = withRecord();
      setStanding(state, null, LATER, true);
      expect(snapshot(lookAt(state, LATER + 100))).toEqual(untold);
    });
  });

  it('shows no quantum light, whatever it is doing', () => {
    const scenarios: ((state: MachineState) => void)[] = [
      () => undefined,
      (state) => setInput(state, '111111', null, 0),
      (state) => startWorking(state, 0),
      (state) => {
        startWorking(state, 0);
        setAnswer(state, 1, 400, true);
      },
      (state) => recall(state, 300),
      (state) => unseal(state, 100, true),
      (state) => setStanding(state, 'established', 200, true),
      (state) => setStanding(state, 'not-established', 200, true),
      (state) => setStanding(state, 'contradicted', 200, true),
      // Even told about a quantum run, a machine in the laboratory shows none of it.
      (state) => reachStage(state, 'superposed', 100),
      (state) => reachStage(state, 'measured', 100, '101101'),
    ];
    for (const prepare of scenarios) {
      const state = createMachineState('classical');
      prepare(state);
      for (let now = 0; now <= 3000; now += 37) {
        const look = lookAt(state, now);
        expect(look.hue).toBe(0);
        expect(look.resonatorGlow.every((level) => level === 0)).toBe(true);
      }
    }
  });
});

describe('the machine at rest', () => {
  /** Every light on the machine that can be put out. */
  const lights = (look: MachineLook): number[] => [
    ...look.ticks,
    ...look.ports,
    ...look.resonatorGlow,
    ...look.resonatorRing,
    look.pointerLevel,
    look.eyeFill,
    look.eyeGlow,
    look.eyeRing,
    look.eyeHot,
    look.digitLevel,
    look.irisLevel,
    look.sweepLevel,
    look.pulseLevel,
    look.halo,
    look.flash,
    look.alarm,
  ];

  const busyMachines = (): MachineState[] => {
    const working = createMachineState('classical');
    setInput(working, '111111', null, 0);
    startWorking(working, 0);
    const contradicted = answered('100000', 1);
    setStanding(contradicted, 'contradicted', 0, true);
    const superposed = createMachineState('quantum');
    reachStage(superposed, 'superposed', 0);
    reachStage(superposed, 'ancilla-ready', 0);
    const measured = createMachineState('quantum');
    reachStage(measured, 'measured', 0, '101101');
    return [answered('100000', 1), answered('000000', 0), working, contradicted, superposed, measured];
  };

  it('has every light out, whatever it was showing — and is still powered', () => {
    for (const state of busyMachines()) {
      const awake = snapshot(lookAt(state, 50));
      expect(Math.max(...lights(awake))).toBeGreaterThan(0.3);

      setResting(state, true, 100, true);
      const atRest = lookAt(state, 100 + LATER);
      expect(Math.max(...lights(atRest))).toBe(0);
      expect(atRest.status).toBeGreaterThan(0);
      expect(atRest.status).toBeLessThanOrEqual(0.5);
    }
  });

  it('goes to rest, and wakes, gradually: its lights fall and rise together', () => {
    const state = answered('100000', 1);
    setResting(state, true, LATER, true);
    let last = lookAt(state, LATER).eyeFill;
    expect(last).toBeGreaterThan(0.2);
    for (let now = LATER + 60; now <= LATER + 1200; now += 60) {
      const fill = lookAt(state, now).eyeFill;
      expect(fill).toBeLessThanOrEqual(last);
      last = fill;
    }
    expect(last).toBe(0);

    setResting(state, false, LATER * 2, true);
    last = 0;
    for (let now = LATER * 2 + 60; now <= LATER * 2 + 1200; now += 60) {
      const fill = lookAt(state, now).eyeFill;
      expect(fill).toBeGreaterThanOrEqual(last);
      last = fill;
    }
    // Awake again, it shows exactly what it showed before.
    expect(snapshot(lookAt(state, LATER * 3))).toEqual(snapshot(lookAt(answered('100000', 1), LATER * 3)));
  });

  it('is simply at rest, or awake, when the change is made without ceremony', () => {
    const state = answered('100000', 1);
    setResting(state, true, 500, false);
    expect(Math.max(...lights(lookAt(state, 501)))).toBe(0);
    setResting(state, false, 600, false);
    expect(lookAt(state, 601).eyeFill).toBeGreaterThan(0.2);
  });

  it('leaves the caps on the resonators as they are: they are hardware, not light', () => {
    const capped = createMachineState('classical');
    setResting(capped, true, 0, false);
    expect(lookAt(capped, 10).caps.every((cap) => cap === 1)).toBe(true);

    const uncapped = createMachineState('classical');
    unseal(uncapped, 0, false);
    setResting(uncapped, true, 0, false);
    expect(lookAt(uncapped, 10).caps.every((cap) => cap === 0)).toBe(true);
  });

  it('throws no light into the room, in either mode', () => {
    for (const mode of ['classical', 'quantum'] as const) {
      const state = createMachineState(mode);
      setResting(state, true, 0, false);
      for (const now of [0, 700, 4200, LATER]) {
        const look = lookAt(state, now);
        expect(look.halo).toBe(0);
        expect(look.flash).toBe(0);
      }
    }
  });

  it('does nothing when told what it already is', () => {
    const state = answered('100000', 1);
    setResting(state, false, 700, true);
    expect(state.restingAt).toBe(Number.NEGATIVE_INFINITY);
    setResting(state, true, 800, true);
    setResting(state, true, 5000, true);
    expect(state.restingAt).toBe(800);
  });
});

describe('the one machine, begun afresh', () => {
  it('starts each investigation with nothing on its dial, in its eye or in its ports', () => {
    const state = answered('100000', 1);
    unseal(state, 0, false);
    setStanding(state, 'established', 0, false);

    resetMachine(state, 'classical');
    expect(snapshot(lookAt(state, LATER))).toEqual(snapshot(lookAt(createMachineState('classical'), LATER)));
    expect(state.record.every((answer) => answer === null)).toBe(true);
    expect(state.sealed).toBe(true);
    expect(state.standing).toBeNull();
  });

  it('carries nothing from the investigation into Quantum Mode, and nothing of a run back out', () => {
    const state = answered('100000', 1);
    resetMachine(state, 'quantum');
    expect(snapshot(lookAt(state, LATER))).toEqual(snapshot(lookAt(createMachineState('quantum'), LATER)));

    reachStage(state, 'measured', 0, '101101');
    resetMachine(state, 'classical');
    expect(state.measured).toBeNull();
    expect(state.stage).toBe(-1);
    expect(lookAt(state, LATER).hue).toBe(0);
    expect(snapshot(lookAt(state, LATER))).toEqual(snapshot(lookAt(createMachineState('classical'), LATER)));
  });

  it('keeps whether it is at rest, and whether motion is reduced: neither is the investigation’s to change', () => {
    const state = createMachineState('classical');
    state.still = true;
    setResting(state, true, 40, true);
    resetMachine(state, 'quantum');
    expect(state.still).toBe(true);
    expect(state.resting).toBe(true);
    expect(state.restingAt).toBe(40);
  });
});

describe('the machine with reduced motion', () => {
  const still = (state: MachineState): MachineState => {
    state.still = true;
    return state;
  };

  it('holds every light steady: nothing pulses, sweeps or turns', () => {
    const working = still(createMachineState('classical'));
    setInput(working, '010110', null, 0);
    startWorking(working, 0);
    const superposed = still(createMachineState('quantum'));
    reachStage(superposed, 'superposed', 0);
    reachStage(superposed, 'ancilla-ready', 0);
    const interfered = still(createMachineState('quantum'));
    reachStage(interfered, 'interfered', 0);

    for (const state of [still(createMachineState('classical')), still(answered('100000', 1)), working, superposed, interfered]) {
      const first = snapshot(lookAt(state, 5000));
      for (const now of [5001, 5137, 6400, 9999]) {
        expect(snapshot(lookAt(state, now))).toEqual(first);
      }
      expect(first.sweepLevel).toBe(0);
      expect(first.pulseLevel).toBe(0);
      expect(first.irisSpeed).toBe(0);
      expect(first.flash).toBe(0);
    }
  });

  it('still says everything: the answer, the record, a working machine, a conclusion contradicted', () => {
    const state = still(answered('100000', 1));
    const look = lookAt(state, 10);
    expect(look.digit).toBe(1);
    expect(look.eyeFill).toBeGreaterThan(0.2);
    expect(look.ticks[dialIndex('100000')]).toBeGreaterThan(0.5);

    const working = still(createMachineState('classical'));
    startWorking(working, 0);
    expect(lookAt(working, 10).eyeGlow).toBeGreaterThan(lookAt(still(createMachineState('classical')), 10).eyeGlow);

    setStanding(state, 'contradicted', 1000, true);
    expect(lookAt(state, 1100).alarm).toBe(1);
    expect(lookAt(state, 3000).alarm).toBe(0);
  });
});

describe('the machine in Quantum Mode', () => {
  /** A run that reached `stage` at the moment `at`, every stage before it having begun at time 0. */
  const runTo = (stage: (typeof QUANTUM_STAGES)[number], at: number, measured?: string): MachineState => {
    const state = createMachineState('quantum');
    beginRun(state);
    for (const id of QUANTUM_STAGES) {
      reachStage(state, id, id === stage ? at : 0, id === 'measured' ? measured : undefined);
      if (id === stage) {
        break;
      }
    }
    return state;
  };

  it('follows the simulator’s own stages, in the simulator’s own order', () => {
    const result = runDeutschJozsa(createOracle(createParityFunction(ORACLE_INPUT_LENGTH, 0b101101)));
    expect(result.steps.map((step) => step.id)).toEqual([...QUANTUM_STAGES]);
  });

  it('is lit by the quantum light, with its resonators uncapped and its ports dark', () => {
    for (const state of [createMachineState('quantum'), runTo('superposed', 0), runTo('measured', 0, '101101')]) {
      const look = lookAt(state, LATER);
      expect(look.hue).toBe(1);
      expect(look.caps.every((cap) => cap === 0)).toBe(true);
      expect(look.ports.every((level) => level === 0)).toBe(true);
    }
  });

  it('waits, before a run: an ember in the eye, nothing on the dial, nothing in the resonators', () => {
    const look = lookAt(createMachineState('quantum'), LATER);
    expect(look.ticks.every((level) => level === 0)).toBe(true);
    expect(look.resonatorGlow.every((level) => level === 0)).toBe(true);
    expect(look.pointerLevel).toBe(0);
    expect(look.eyeGlow).toBeGreaterThan(0);
    expect(look.eyeGlow).toBeLessThan(0.25);
  });

  it('prepared: every resonator holds a 0 — a ring of light with nothing in it', () => {
    const look = lookAt(runTo('prepared', 0), LATER);
    expect(look.resonatorRing.every((level) => level > 0.5)).toBe(true);
    expect(look.resonatorGlow.every((level) => level === 0)).toBe(true);
    expect(look.ticks.every((level) => level === 0)).toBe(true);
  });

  it('superposed: all sixty-four ticks are lit, and all six resonators of the input', () => {
    const look = lookAt(runTo('superposed', 0), LATER);
    expect(look.ticks.every((level) => level > 0.25)).toBe(true);
    for (let resonator = 0; resonator < ORACLE_INPUT_LENGTH; resonator += 1) {
      expect(look.resonatorGlow[resonator]).toBeGreaterThan(0.2);
    }
    // The spare one has not been touched yet.
    expect(look.resonatorGlow[SPARE_RESONATOR]).toBe(0);
    expect(look.pointerLevel).toBe(0); // There is no one input to point at.
  });

  it('then the spare resonator is readied, and swings against the other six', () => {
    const state = runTo('ancilla-ready', 0);
    let opposed = 0;
    let samples = 0;
    for (let now = 3000; now < 3000 + 2800; now += 70) {
      const look = lookAt(state, now);
      expect(look.resonatorGlow[SPARE_RESONATOR]).toBeGreaterThan(0);
      const others = look.resonatorGlow[0] ?? 0;
      const spare = look.resonatorGlow[SPARE_RESONATOR] ?? 0;
      if ((others - 0.52) * (spare - 0.46) < 0) {
        opposed += 1;
      }
      samples += 1;
    }
    expect(opposed / samples).toBeGreaterThan(0.9);
  });

  it('the query touches every tick in the same instant, and sweeps once round the dial', () => {
    const state = runTo('queried', 10_000);
    const before = snapshot(lookAt(runTo('ancilla-ready', 0), 10_000 - 1));
    const struck = lookAt(state, 10_020);

    expect(struck.sweepLevel).toBe(1);
    expect(struck.flash).toBeGreaterThan(0.5);
    expect(struck.ticks.every((level) => level > 0.6)).toBe(true);
    expect(before.ticks.every((level) => level < 0.6)).toBe(true);
    expect(lookAt(state, 10_000 + 500).sweepLevel).toBe(0);
    expect(lookAt(state, 10_000 + 400).sweepTurn).toBeLessThanOrEqual(1);
  });

  it('interference drains the dial, and leaves the six resonators unsettled', () => {
    const state = runTo('interfered', 10_000);
    const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(mean(lookAt(state, 10_000 + 30).ticks)).toBeGreaterThan(mean(lookAt(state, 10_000 + 880).ticks) * 2);
    const levels = new Set<number>();
    for (let now = 10_400; now < 10_900; now += 45) {
      levels.add(Math.round((lookAt(state, now).resonatorGlow[2] ?? 0) * 20));
    }
    expect(levels.size).toBeGreaterThan(3);
  });

  it('measured: each of the six resonators is a 1 or a 0, exactly as the measurement read', () => {
    for (const measured of ['101101', '000000', '111111', '010010', '000001', '100000']) {
      const look = lookAt(runTo('measured', 0, measured), LATER);
      for (let resonator = 0; resonator < ORACLE_INPUT_LENGTH; resonator += 1) {
        if (measured[resonator] === '1') {
          expect(look.resonatorGlow[resonator]).toBe(1);
        } else {
          expect(look.resonatorGlow[resonator]).toBe(0);
          expect(look.resonatorRing[resonator]).toBeGreaterThan(0.5);
        }
      }
      // One tick is left lit — the reading's — and the pointer goes to it.
      const lit = look.ticks.map((level, tick) => (level > 0.5 ? tick : -1)).filter((tick) => tick >= 0);
      expect(lit).toEqual([dialIndex(measured)]);
      expect(look.pointerLevel).toBe(1);
      expect(look.pointerTurn).toBe(tickTurn(dialIndex(measured)));
    }
  });

  it('shows what the simulator actually measured, for either kind of machine', () => {
    const functions = [
      createParityFunction(ORACLE_INPUT_LENGTH, 0b101101),
      createParityFunction(ORACLE_INPUT_LENGTH, 0b000001),
      createConstantFunction(ORACLE_INPUT_LENGTH, 0),
      createConstantFunction(ORACLE_INPUT_LENGTH, 1),
    ];
    for (const hidden of functions) {
      const result = runDeutschJozsa(createOracle(hidden));
      const state = createMachineState('quantum');
      beginRun(state);
      for (const step of result.steps) {
        // Exactly what the scene hands over: the stage, and — at the measurement — the reading.
        reachStage(state, step.id, 0, step.id === 'measured' ? result.measuredLabel : undefined);
      }
      const look = lookAt(state, LATER);
      const shownBits = Array.from({ length: ORACLE_INPUT_LENGTH }, (_, resonator) =>
        (look.resonatorGlow[resonator] ?? 0) > 0.5 ? '1' : '0',
      ).join('');
      expect(shownBits).toBe(result.measuredLabel);
    }
  });

  it('never measures the spare resonator: it goes on as it was', () => {
    const before = lookAt(runTo('interfered', 0), 7000).resonatorGlow[SPARE_RESONATOR];
    const after = lookAt(runTo('measured', 0, '101101'), 7000).resonatorGlow[SPARE_RESONATOR];
    expect(after).toBe(before);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(1);
  });

  it('never puts an answer in the eye: a run produces a reading, not a 0 or a 1', () => {
    for (const id of QUANTUM_STAGES) {
      for (const now of [0, 120, 600, LATER]) {
        const look = lookAt(runTo(id, 0, '101101'), now);
        expect(look.digit).toBeNull();
        expect(look.digitLevel).toBe(0);
        expect(look.eyeFill).toBe(0);
      }
    }
  });

  describe('gives nothing away before the measurement', () => {
    const beforeMeasurement = QUANTUM_STAGES.filter((id) => id !== 'measured');

    it('is told nothing about the outcome until the measurement, even if it is offered', () => {
      for (const id of beforeMeasurement) {
        const state = createMachineState('quantum');
        reachStage(state, id, 0, '101101');
        expect(state.measured).toBeNull();
      }
    });

    it('looks exactly the same whatever the run is going to read', () => {
      for (const id of beforeMeasurement) {
        for (const now of [0, 90, 430, 880, LATER]) {
          const looks = ['000000', '101101', '111111', '010101'].map((measured) => {
            const state = runTo(id, 0);
            state.measured = measured; // Even with the reading forced into its state ahead of time.
            return snapshot(lookAt(state, now));
          });
          for (const look of looks) {
            expect(look).toEqual(looks[0]);
          }
        }
      }
    });

    it('treats all sixty-four ticks alike, and all six resonators of the input alike', () => {
      for (const id of beforeMeasurement) {
        const state = runTo(id, 0);
        state.still = true; // With the shimmer taken out, what is left is what each one is being told.
        const look = lookAt(state, LATER);
        expect(new Set(look.ticks).size).toBe(1);
        expect(new Set(look.resonatorGlow.slice(0, ORACLE_INPUT_LENGTH)).size).toBe(1);
        expect(new Set(look.resonatorRing.slice(0, ORACLE_INPUT_LENGTH)).size).toBe(1);
      }
    });

    it('never singles a tick out with the pointer', () => {
      for (const id of beforeMeasurement) {
        expect(lookAt(runTo(id, 0), LATER).pointerLevel).toBe(0);
      }
    });
  });

  it('accepts as a reading only six binary digits', () => {
    for (const nonsense of ['', '10110', '1011010', 'abcdef', '10110x']) {
      const state = runTo('measured', 0, nonsense);
      expect(state.measured).toBeNull();
      // With nothing to show, it singles nothing out.
      expect(lookAt(state, LATER).pointerLevel).toBe(0);
    }
  });

  it('takes stages that arrive together, or out of step, in its stride', () => {
    // The spare is readied in the same instant the input is superposed.
    const together = createMachineState('quantum');
    reachStage(together, 'prepared', 0);
    reachStage(together, 'superposed', 1000);
    reachStage(together, 'ancilla-ready', 1000);
    const look = lookAt(together, 1000 + LATER);
    expect(look.ticks.every((level) => level > 0.25)).toBe(true);
    expect(look.resonatorGlow[SPARE_RESONATOR]).toBeGreaterThan(0);

    // A stage that was never announced began when the one after it did.
    const skipped = createMachineState('quantum');
    reachStage(skipped, 'queried', 500);
    expect(skipped.stageAt.slice(0, 4)).toEqual([500, 500, 500, 500]);
    expect(skipped.stage).toBe(3);
    // A stage announced late does not take the run backwards.
    reachStage(skipped, 'prepared', 900);
    expect(skipped.stage).toBe(3);
    expect(skipped.stageAt[0]).toBe(500);
  });

  it('clears everything when another run begins', () => {
    const state = runTo('measured', 0, '101101');
    beginRun(state);
    expect(state.stage).toBe(-1);
    expect(state.measured).toBeNull();
    expect(snapshot(lookAt(state, LATER))).toEqual(snapshot(lookAt(createMachineState('quantum'), LATER)));
  });
});

describe('the machine only looks the part', () => {
  const machineFiles = [
    '/entities/OracleMachine.ts',
    '/entities/oracleMachineModel.ts',
    '/entities/oracleMachineLayout.ts',
    '/entities/oracleMachineTextures.ts',
  ];

  it('takes nothing from the quantum engine or from the oracle’s logic but the names of things', () => {
    for (const file of machineFiles) {
      const imports = [...codeOf(file).matchAll(/import\s+(type\s+)?[^;]*?from\s+'([^']+)';/g)];
      expect(imports.length).toBeGreaterThan(0);
      for (const [, typeOnly, path] of imports) {
        if (path?.includes('/quantum') || path?.includes('/systems/')) {
          expect(typeOnly, `${file} imports from ${path}`).toBeDefined();
        }
      }
    }
  });

  it('never reaches for the machine’s rule, a truth table, or the state of a run', () => {
    for (const file of machineFiles) {
      expect(codeOf(file)).not.toMatch(/HIDDEN_FUNCTION|ORACLE_INSTANCE|hiddenFunction|truthTable|\.evaluate\(|getAmplitude|getProbabilities|\.verdict/);
    }
  });

  it('is told about a run by its stage alone — and, at the measurement only, by what was read', () => {
    const scene = codeOf('/scenes/QuantumScene.ts');
    expect(scene).toMatch(/this\.machine\.showRunStage\(step\.id, step\.id === 'measured' \? result\.measuredLabel : undefined\);/);
    // It is the room's machine, begun afresh in Quantum Mode; after that it is told when a run starts, and each stage.
    expect(scene).toMatch(/this\.machine = room\.machine;\s*this\.machine\.begin\('quantum'\);/);
    expect(scene.match(/this\.machine\.\w+\(/g)).toEqual(['this.machine.begin(', 'this.machine.beginRun(', 'this.machine.showRunStage(']);
    // The state of the run itself never leaves the engine for the canvas.
    expect(scene).not.toMatch(/step\.state/);
  });

  it('is told about the investigation only what the laboratory already shows', () => {
    const scene = codeOf('/scenes/LaboratoryScene.ts');
    const told = [...new Set(scene.match(/this\.machine\.\w+/g))].sort();
    expect(told).toEqual([
      'this.machine.begin',
      'this.machine.restoreRecord',
      'this.machine.showAnswer',
      'this.machine.showInput',
      'this.machine.showRecall',
      'this.machine.showStanding',
      'this.machine.startProcessing',
      'this.machine.unsealResonators',
    ]);
    // The answer it shows for the input as composed is the record's — the same one the console prints.
    expect(scene).toMatch(/const recorded = this\.recordedAnswer\(\);\s*this\.view\.renderInput\(this\.binaryInput, recorded\);\s*this\.machine\.showInput\(toBinaryString\(this\.binaryInput\), recorded\?\.output \?\? null\);/);
  });

  it('keeps the verdict out of Quantum Mode: the reading is shown there, and what it means is the reveal’s to say', () => {
    const view = codeOf('/ui/views/quantumView.ts');
    expect(view).not.toMatch(/verdict/);
    expect(view).toMatch(/result\.measuredLabel/);
    expect(codeOf('/ui/views/revealView.ts')).toMatch(/verdict/);
  });

  it('uses the quantum colours on the canvas only for a machine in Quantum Mode', () => {
    const entity = codeOf('/entities/OracleMachine.ts');
    const uses = entity.match(/'quantum(Indigo|Bright)'/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    // Every use is chosen by the look's hue, which the laboratory's machine never raises (tested above).
    expect(entity.match(/quantum \? 'quantum(Indigo|Bright)' : 'instrument'/g)).toHaveLength(uses.length);
    expect(entity).toMatch(/const quantum = look\.hue >= 0\.5;/);
    for (const file of ['/entities/oracleMachineTextures.ts', '/world/roomTextures.ts', '/scenes/LaboratoryScene.ts']) {
      expect(codeOf(file)).not.toMatch(/quantum(Indigo|Bright)/);
    }
  });
});
