import Phaser from 'phaser';
import type { Bit } from '../../quantum';
import type { DeutschJozsaStepId } from '../../quantum/deutschJozsa';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { colorNumber } from '../config/designTokens';
import { DESIGN_WIDTH } from '../config/display';
import type { ConclusionStanding } from '../systems/oracle/evidence';
import {
  MACHINE,
  PORT_COUNT,
  RESONATOR_COUNT,
  TICK_COUNT,
  aroundEye,
  portPosition,
  resonatorPosition,
  shortestTurn,
  tickAngle,
  turnToAngle,
  type Point,
} from './oracleMachineLayout';
import {
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
  type MachineMode,
  type MachineState,
} from './oracleMachineModel';
import { MACHINE_PARTS, PART_GEOMETRY } from './oracleMachineTextures';

type Image = Phaser.GameObjects.Image;

const ADD = Phaser.BlendModes.ADD;
const NORMAL = Phaser.BlendModes.NORMAL;
const FULL_TURN = Math.PI * 2;

/** How quickly each kind of light settles to a new brightness: the time, in ms, to cover about two thirds of the way. */
const SETTLE = { tick: 70, port: 50, resonator: 90, eye: 80, digit: 70, pointer: 60, alarm: 40 } as const;

/** The span of the sweep's arc, in radians — it must match the arc drawn in the parts sheet. */
const SWEEP_SPAN = 1.1;

/** Blends two `0xRRGGBB` colours. */
function mixColor(from: number, to: number, amount: number): number {
  if (amount <= 0) {
    return from;
  }
  if (amount >= 1) {
    return to;
  }
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/**
 * The machine as it appears on screen: a graphite body built round one eye.
 *
 *   the eye        shows the answer — a digit behind smoked glass. A 1 fills
 *                  the eye with light; a 0 is a ring of light, empty inside
 *   the dial       a tick for each of the 64 inputs. A pointer rides round
 *                  it to the input being composed, and every input that has
 *                  been asked leaves its tick lit — so the dial is the record
 *   the ports      six, in the chin: the bits of the input, as they are set
 *   the resonators seven, round the eye, capped until the laboratory
 *                  discloses the constraint. In Quantum Mode they are what
 *                  the run is seen on
 *
 * It only LOOKS the part. It is told what has happened — an input, an
 * answer, a stage of a run — and shows it. What an answer is gets decided
 * elsewhere (systems/oracle for a question, src/quantum for a run), and the
 * machine's rule never comes near this class. What is shown for a given
 * state is worked out in oracleMachineModel.ts; this class only puts it on
 * the canvas, a frame at a time.
 */
export class OracleMachine extends Phaser.GameObjects.Container {
  private readonly model: MachineState;
  private readonly look = createMachineLook();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** One texture pixel in design units: every part is painted at the canvas's own pixel density. */
  private readonly unit: number;

  private readonly chassis: Image;
  private readonly eyeLight: Image;
  private readonly pool: Image;
  private readonly halo: Image;
  private readonly statusLight: Image;
  private readonly ports: Image[] = [];
  private readonly ticks: Image[] = [];
  private readonly tickIsShort: boolean[] = new Array<boolean>(TICK_COUNT).fill(false);
  private readonly sweep: Image;
  private readonly pointer: Image;
  private readonly eyeFill: Image;
  private readonly eyeGlow: Image;
  private readonly eyeHot: Image;
  private readonly eyeRing: Image;
  private readonly iris: Image[];
  private readonly pulse: Image;
  private readonly flash: Image;
  private readonly digits: [Image, Image];
  private readonly resonatorRings: Image[] = [];
  private readonly resonatorGlows: Image[] = [];
  private readonly caps: Image[] = [];

  /** Brightnesses as they are on screen now, easing toward what `look` asks for. */
  private readonly shown = {
    ticks: new Array<number>(TICK_COUNT).fill(0),
    ports: new Array<number>(PORT_COUNT).fill(0),
    resonatorGlow: new Array<number>(RESONATOR_COUNT).fill(0),
    resonatorRing: new Array<number>(RESONATOR_COUNT).fill(0),
    digits: [0, 0] as [number, number],
    eyeFill: 0,
    eyeGlow: 0,
    eyeHot: 0,
    eyeRing: 0,
    irisLevel: 0,
    halo: 0,
    alarm: 0,
    pointerTurn: 0,
    pointerLevel: 0,
  };
  private lastFrameAt = 0;
  private hasDrawn = false;
  private recordColor = -1;
  private eyeColor = -1;
  private bodyTint = 0xffffff;
  /** The light the machine is throwing into the room at this moment: how much, and what colour. */
  private emitted = 0;
  private emittedColor = colorNumber('instrument');

  /** Positioned by the centre of the machine's body. */
  constructor(scene: Phaser.Scene, x: number, y: number, mode: MachineMode = 'classical') {
    super(scene, x, y);
    this.model = createMachineState(mode);
    this.unit = DESIGN_WIDTH / scene.scale.width;

    const { width, height, margin, eye, statusLight, lensRadius, base, track, dial } = MACHINE;
    const centre = { x: width / 2, y: height / 2 };
    /** A point on the body, as an offset from this container's origin (the centre of the body). */
    const at = (point: Point): Point => ({ x: point.x - centre.x, y: point.y - centre.y });
    const eyeAt = at(eye);
    const part = (frame: string, point: Point, blend: Phaser.BlendModes = ADD, scale = 1): Image =>
      new Phaser.GameObjects.Image(scene, point.x, point.y, TEXTURE_KEYS.oracleMachineParts, frame)
        .setScale(this.unit * scale)
        .setBlendMode(blend);

    // --- Beneath the body: light on the floor ---
    this.pool = part(MACHINE_PARTS.pool, { x: 0, y: height / 2 + base.neckHeight + base.footHeight + 5 });

    // --- The body, and the same body as the eye's light catches it ---
    this.chassis = new Phaser.GameObjects.Image(scene, 0, (margin.bottom - margin.top) / 2, TEXTURE_KEYS.oracleMachine);
    this.chassis.setDisplaySize(width + margin.x * 2, height + margin.top + margin.bottom);
    this.eyeLight = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.oracleMachineLight);
    this.eyeLight.setDisplaySize(width, height).setBlendMode(ADD);

    // --- Lights on the body ---
    this.statusLight = part(MACHINE_PARTS.status, at(statusLight)).setTint(colorNumber('signalRed'));
    for (let bit = 0; bit < PORT_COUNT; bit += 1) {
      this.ports.push(part(MACHINE_PARTS.port, at(portPosition(bit))));
    }
    const tickRadius = (dial.tickInner + dial.tickOuter) / 2;
    for (let tick = 0; tick < TICK_COUNT; tick += 1) {
      const angle = tickAngle(tick);
      this.ticks.push(part(MACHINE_PARTS.tick, at(aroundEye(angle, tickRadius))).setRotation(angle + Math.PI / 2));
    }
    // The sweep is an arc drawn at the top of the dial; turning it about the centre of the eye carries it round.
    this.sweep = part(MACHINE_PARTS.sweep, eyeAt);
    this.sweep.setOrigin(0.5, 0.5 + PART_GEOMETRY.sweepOffset / (this.sweep.height * this.unit));
    this.pointer = part(MACHINE_PARTS.pointer, at(aroundEye(turnToAngle(0), track.radius)));

    // --- Inside the eye, back to front: its light, its rings, the digit, then the glass over all of it ---
    this.eyeFill = part(MACHINE_PARTS.fill, eyeAt);
    this.eyeGlow = part(MACHINE_PARTS.glow, eyeAt, ADD, (lensRadius * 0.9) / PART_GEOMETRY.glowRadius);
    this.eyeHot = part(MACHINE_PARTS.hot, eyeAt);
    this.eyeRing = part(MACHINE_PARTS.ring, eyeAt);
    this.iris = [
      part(MACHINE_PARTS.irisOuter, eyeAt),
      part(MACHINE_PARTS.irisMiddle, eyeAt),
      part(MACHINE_PARTS.irisInner, eyeAt),
    ];
    this.pulse = part(MACHINE_PARTS.pulse, eyeAt);
    this.flash = part(MACHINE_PARTS.glow, eyeAt, ADD, (lensRadius * 1.25) / PART_GEOMETRY.glowRadius);
    this.digits = [part(MACHINE_PARTS.digit0, eyeAt), part(MACHINE_PARTS.digit1, eyeAt)];
    const glass = part(MACHINE_PARTS.glass, eyeAt, NORMAL);
    // What spills past the glass: a wide, faint bloom over the metal round the eye.
    this.halo = part(MACHINE_PARTS.glow, eyeAt, ADD, 200 / PART_GEOMETRY.glowRadius);

    // --- The resonators: a ring of light, a filled light, and the cap that hides both ---
    for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
      const seat = at(resonatorPosition(resonator));
      this.resonatorRings.push(part(MACHINE_PARTS.nodeRing, seat));
      this.resonatorGlows.push(part(MACHINE_PARTS.node, seat));
      this.caps.push(part(MACHINE_PARTS.cap, seat, NORMAL));
    }

    this.add([
      this.pool,
      this.chassis,
      this.eyeLight,
      this.statusLight,
      ...this.ports,
      ...this.ticks,
      this.sweep,
      this.pointer,
      this.eyeFill,
      this.eyeGlow,
      this.eyeHot,
      this.eyeRing,
      ...this.iris,
      this.pulse,
      this.flash,
      ...this.digits,
      glass,
      this.halo,
      ...this.resonatorRings,
      ...this.resonatorGlows,
      ...this.caps,
    ]);
    this.setSize(width, height);
    scene.add.existing(this);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.draw, this);
    this.draw();
  }

  /* ---------- What the machine is told ---------- */

  /**
   * Starts the machine afresh in a mode — nothing on record, nothing running —
   * and wakes it if it was at rest. Every investigation, and every visit to
   * Quantum Mode, begins with this: there is one machine, and it stays in the room.
   */
  begin(mode: MachineMode): void {
    resetMachine(this.model, mode);
    setResting(this.model, false, performance.now(), true);
  }

  /** Puts the machine to rest: every light out but the status light. With `animate` off it is simply at rest. */
  rest(animate = true): void {
    setResting(this.model, true, performance.now(), animate);
  }

  /**
   * How much of the room's light is falling on the machine, from 0 to 1. The
   * body is painted as it looks in full light; in a darker room it is darker.
   * Its own lights are not affected.
   */
  setRoomLight(level: number): void {
    const value = Math.round(255 * (0.3 + 0.7 * Math.min(1, Math.max(0, level))));
    const tint = (value << 16) | (value << 8) | value;
    if (tint !== this.bodyTint) {
      this.bodyTint = tint;
      this.chassis.setTint(tint);
    }
  }

  /** How much light the machine is throwing into the room at this moment, from 0 to 1. */
  get emission(): number {
    return this.emitted;
  }

  /** The colour of that light. */
  get emissionColor(): number {
    return this.emittedColor;
  }

  /**
   * The input as it now stands, and the answer the record already holds for
   * it (`null` if it has not been asked). The ports and the dial follow the
   * input; the eye shows the recorded answer, if there is one.
   */
  showInput(input: string, recorded: Bit | null): void {
    setInput(this.model, input, recorded, performance.now());
  }

  /** The machine has been given an input: its last answer clears and it visibly sets to work. */
  startProcessing(): void {
    startWorking(this.model, performance.now());
  }

  /**
   * The machine answers: the digit appears in the eye, and the input's tick
   * on the dial stays lit from now on. With `animate` off the answer is
   * simply there.
   */
  showAnswer(output: Bit, animate = true): void {
    setAnswer(this.model, output, performance.now(), animate);
  }

  /** The player asked about an input that is already on record. No query is used, and the machine does not set to work. */
  showRecall(): void {
    recall(this.model, performance.now());
  }

  /** Puts a record that already exists back on the dial — used when the player returns to an investigation under way. */
  restoreRecord(record: readonly { readonly input: string; readonly output: Bit }[]): void {
    restoreRecord(this.model, record);
  }

  /** The laboratory has disclosed the constraint: the caps come off the resonators. */
  unsealResonators(animate = true): void {
    unseal(this.model, performance.now(), animate);
  }

  /** How the conclusion on record stands against the evidence. The machine answers a change in it, once. */
  showStanding(standing: ConclusionStanding | null, animate = true): void {
    setStanding(this.model, standing, performance.now(), animate);
  }

  /** Quantum Mode: a run is about to start. Whatever the last run left on the machine is cleared. */
  beginRun(): void {
    beginRun(this.model);
  }

  /**
   * Quantum Mode: the run has reached a stage. The machine is told which —
   * and, at the measurement only, what the measurement read. It is given
   * nothing else about the run.
   */
  showRunStage(stage: DeutschJozsaStepId, measured?: string): void {
    reachStage(this.model, stage, performance.now(), measured);
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.events.off(Phaser.Scenes.Events.UPDATE, this.draw, this);
    super.destroy(fromScene);
  }

  /* ---------- Putting it on the canvas ---------- */

  private draw(): void {
    if (!this.scene) {
      return;
    }
    const now = performance.now();
    const elapsed = this.hasDrawn ? Math.max(0, now - this.lastFrameAt) : 0;
    this.lastFrameAt = now;

    const state = this.model;
    state.still = this.reducedMotion.matches;
    const look = computeLook(state, now, this.look);
    const shown = this.shown;

    // The first frame, and every frame under reduced motion, simply takes its values. Otherwise each light eases toward its own.
    const snap = !this.hasDrawn || state.still;
    const toward = (settleMs: number): number => (snap ? 1 : 1 - Math.exp(-elapsed / settleMs));
    this.hasDrawn = true;

    // --- Colour: the classical white, or the quantum light. The warning colour takes the eye only:
    //     what is on record — the dial, the ports, the resonators — is not in question, and keeps its own. ---
    shown.alarm += (look.alarm - shown.alarm) * toward(SETTLE.alarm);
    const quantum = look.hue >= 0.5;
    const recordColor = colorNumber(quantum ? 'quantumBright' : 'instrument');
    if (recordColor !== this.recordColor) {
      this.recordColor = recordColor;
      for (const image of [...this.ticks, ...this.ports, ...this.resonatorRings, ...this.resonatorGlows, this.sweep, this.pointer]) {
        image.setTint(recordColor);
      }
    }
    const eyeColor = mixColor(recordColor, colorNumber('signalRed'), shown.alarm);
    if (eyeColor !== this.eyeColor) {
      this.eyeColor = eyeColor;
      const deepColor = mixColor(colorNumber(quantum ? 'quantumIndigo' : 'instrument'), colorNumber('signalRed'), shown.alarm);
      this.emittedColor = deepColor;
      for (const image of [...this.iris, ...this.digits, this.eyeHot, this.eyeRing, this.pulse, this.flash]) {
        image.setTint(eyeColor);
      }
      for (const image of [this.eyeFill, this.eyeGlow, this.eyeLight, this.halo, this.pool]) {
        image.setTint(deepColor);
      }
    }

    // --- Dial ---
    const tickEase = toward(SETTLE.tick);
    for (let tick = 0; tick < TICK_COUNT; tick += 1) {
      const image = this.ticks[tick];
      if (!image) {
        continue;
      }
      const level = (shown.ticks[tick] ?? 0) + ((look.ticks[tick] ?? 0) - (shown.ticks[tick] ?? 0)) * tickEase;
      shown.ticks[tick] = level;
      const short = look.tickShort[tick] === true;
      if (short !== this.tickIsShort[tick]) {
        this.tickIsShort[tick] = short;
        image.setFrame(short ? MACHINE_PARTS.tickShort : MACHINE_PARTS.tick);
      }
      image.setAlpha(level).setVisible(level > 0.004);
    }

    shown.pointerTurn += shortestTurn(shown.pointerTurn, look.pointerTurn) * toward(SETTLE.pointer);
    shown.pointerLevel += (look.pointerLevel - shown.pointerLevel) * toward(SETTLE.eye);
    const pointerAngle = turnToAngle(shown.pointerTurn);
    const eyeX = MACHINE.eye.x - MACHINE.width / 2;
    const eyeY = MACHINE.eye.y - MACHINE.height / 2;
    this.pointer
      .setPosition(eyeX + Math.cos(pointerAngle) * MACHINE.track.radius, eyeY + Math.sin(pointerAngle) * MACHINE.track.radius)
      .setRotation(pointerAngle + Math.PI / 2)
      .setAlpha(shown.pointerLevel);

    this.sweep
      .setRotation(look.sweepTurn * FULL_TURN - SWEEP_SPAN / 2)
      .setAlpha(look.sweepLevel * 0.6)
      .setVisible(look.sweepLevel > 0);

    // --- Ports ---
    const portEase = toward(SETTLE.port);
    for (let bit = 0; bit < PORT_COUNT; bit += 1) {
      const level = (shown.ports[bit] ?? 0) + ((look.ports[bit] ?? 0) - (shown.ports[bit] ?? 0)) * portEase;
      shown.ports[bit] = level;
      this.ports[bit]?.setAlpha(level);
    }

    // --- Eye ---
    const eyeEase = toward(SETTLE.eye);
    shown.eyeFill += (look.eyeFill - shown.eyeFill) * eyeEase;
    shown.eyeGlow += (look.eyeGlow - shown.eyeGlow) * eyeEase;
    shown.eyeHot += (look.eyeHot - shown.eyeHot) * eyeEase;
    shown.eyeRing += (look.eyeRing - shown.eyeRing) * eyeEase;
    shown.irisLevel += (look.irisLevel - shown.irisLevel) * eyeEase;
    shown.halo += (look.halo - shown.halo) * eyeEase;
    this.eyeFill.setAlpha(shown.eyeFill);
    this.eyeGlow.setAlpha(shown.eyeGlow);
    this.eyeHot.setAlpha(shown.eyeHot * 0.9);
    this.eyeRing.setAlpha(shown.eyeRing);
    this.flash.setAlpha(look.flash * 0.45);

    const digitEase = toward(SETTLE.digit);
    for (const digit of [0, 1] as const) {
      const target = look.digit === digit ? look.digitLevel : 0;
      shown.digits[digit] += (target - shown.digits[digit]) * digitEase;
      this.digits[digit].setAlpha(shown.digits[digit]);
    }

    // The three rings turn at different rates, the middle one against the other two.
    const turned = look.irisSpeed * (Math.min(elapsed, 250) / 1000) * FULL_TURN;
    const [outer, middle, inner] = this.iris;
    outer?.setRotation(outer.rotation + turned).setAlpha(shown.irisLevel * 0.42);
    middle?.setRotation(middle.rotation - turned * 1.7).setAlpha(shown.irisLevel * 0.3);
    inner?.setRotation(inner.rotation + turned * 2.6).setAlpha(shown.irisLevel * 0.46);

    this.pulse.setScale(this.unit * look.pulseScale).setAlpha(look.pulseLevel);

    // --- Status light, and the light the eye throws on everything round it ---
    this.statusLight.setAlpha(look.status);
    this.eyeLight.setAlpha(Math.min(1, shown.halo * 1.5));
    this.emitted = Math.min(1, shown.halo * 1.9 + look.flash * 0.5);
    this.halo.setAlpha(shown.halo * 0.4);
    this.pool.setAlpha(0.1 + shown.halo * 0.5);

    // --- Resonators ---
    const resonatorEase = toward(SETTLE.resonator);
    for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
      const glow = (shown.resonatorGlow[resonator] ?? 0) + ((look.resonatorGlow[resonator] ?? 0) - (shown.resonatorGlow[resonator] ?? 0)) * resonatorEase;
      const ring = (shown.resonatorRing[resonator] ?? 0) + ((look.resonatorRing[resonator] ?? 0) - (shown.resonatorRing[resonator] ?? 0)) * resonatorEase;
      shown.resonatorGlow[resonator] = glow;
      shown.resonatorRing[resonator] = ring;
      this.resonatorGlows[resonator]?.setAlpha(glow);
      this.resonatorRings[resonator]?.setAlpha(ring);

      const cap = look.caps[resonator] ?? 1;
      this.caps[resonator]
        ?.setAlpha(cap)
        .setScale(this.unit * (0.82 + 0.18 * cap))
        .setVisible(cap > 0.004);
    }
  }
}
