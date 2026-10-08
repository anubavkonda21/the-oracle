import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { colorNumber } from '../config/designTokens';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/display';
import { SCENE_KEYS } from '../config/sceneKeys';
import { OracleMachine } from '../entities/OracleMachine';
import { MACHINE_PARTS } from '../entities/oracleMachineTextures';
import { createLightRig, levelsAt, setLighting, setWorking, type LightingState } from '../world/lightRig';
import { LAMPS, MACHINE_AT, ROOM, SCREENS, lampLevel, type Lamp } from '../world/roomLayout';
import { FIXTURE_GLOW, HAZE, LIGHT_SCALE, ROOM_PARTS } from '../world/roomTextures';

type Image = Phaser.GameObjects.Image;

const ADD = Phaser.BlendModes.ADD;
const MULTIPLY = Phaser.BlendModes.MULTIPLY;

/** Blends two `0xRRGGBB` colours. */
function mixColor(from: number, to: number, amount: number): number {
  const t = Math.min(1, Math.max(0, amount));
  const channel = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * t) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}

/**
 * The laboratory: the one room the whole game takes place in.
 *
 * It is started once, when the game has loaded, and never stopped. The
 * scenes the player moves through — the menu, the investigation, Quantum
 * Mode, the reveal, the credits — come and go on top of it, and bring only
 * their interface; the room, and the machine standing in it, stay. So moving
 * from one to the next is a change of light in a room that is still there,
 * not a cut to somewhere else.
 *
 * Those scenes tell the room two things: what state the light should be in
 * (`light`), and whether the machine is working (`work`). They reach the
 * machine through `machine`. The room decides nothing — it is told, and shows.
 *
 * How it is lit. The room is painted once with every light on. Each frame, a
 * small light map is made — the room's darkness, plus each source's picture
 * of where its light falls, as bright as that source now is — and multiplied
 * over the painting. The machine's own light is one of the sources, at
 * whatever strength and colour the machine is giving out, so the room
 * answers to the machine without being told to. Lamps, screens and the
 * light fittings glow by themselves, over the top.
 */
export class RoomScene extends Phaser.Scene {
  private rig = createLightRig('dormant');
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  private theMachine!: OracleMachine;
  private lightMap!: Phaser.GameObjects.RenderTexture;
  private haze!: Image;
  private keyFixture!: Image;
  private fillFixtures: Image[] = [];
  private screens: Image[] = [];
  private lamps: { lamp: Lamp; image: Image }[] = [];
  /** What the light map was last drawn with, so it is redrawn only when something has changed. */
  private drawn = '';

  constructor() {
    super(SCENE_KEYS.room);
  }

  /** The machine. It stands in the room for as long as the game runs. */
  get machine(): OracleMachine {
    return this.theMachine;
  }

  /** The lighting state the room is in, or on its way to. */
  get lighting(): LightingState {
    return this.rig.state;
  }

  /** Moves the room's light to a state. */
  light(state: LightingState): void {
    setLighting(this.rig, state, performance.now(), this.reducedMotion.matches);
  }

  /** The machine has set to work on a question, or has finished. */
  work(working: boolean): void {
    setWorking(this.rig, working, performance.now(), this.reducedMotion.matches);
  }

  create(): void {
    // The canvas is larger than the design frame by the render resolution; zooming by the same factor cancels it out.
    this.cameras.main.setZoom(this.scale.width / DESIGN_WIDTH).centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    this.rig = createLightRig('dormant');
    this.drawn = '';

    // --- The painted room, and the light laid over it ---
    this.add.image(0, 0, TEXTURE_KEYS.room).setOrigin(0).setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.lightMap = this.add
      .renderTexture(0, 0, Math.round(DESIGN_WIDTH * LIGHT_SCALE), Math.round(DESIGN_HEIGHT * LIGHT_SCALE))
      .setOrigin(0)
      .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
      .setBlendMode(MULTIPLY);

    // --- What glows by itself: the air in the work light, the fittings, the screens, the lamps ---
    this.haze = this.add
      .image(HAZE.x, HAZE.y, TEXTURE_KEYS.roomHaze)
      .setOrigin(0.5, 0)
      .setDisplaySize(HAZE.width, HAZE.height)
      .setBlendMode(ADD)
      .setTint(colorNumber('instrument'));

    const fixture = (rect: { x: number; y: number; width: number; height: number }): Image => {
      const glow = (FIXTURE_GLOW * rect.width) / ROOM.fixtures.key.width;
      return this.add
        .image(rect.x + rect.width / 2, rect.y + rect.height / 2, TEXTURE_KEYS.roomParts, ROOM_PARTS.fixture)
        .setDisplaySize(rect.width + glow * 2, rect.height + FIXTURE_GLOW * 2)
        .setBlendMode(ADD)
        .setTint(colorNumber('instrument'));
    };
    this.keyFixture = fixture(ROOM.fixtures.key);
    this.fillFixtures = [fixture(ROOM.fixtures.fillLeft), fixture(ROOM.fixtures.fillRight)];

    this.screens = SCREENS.map((screen) =>
      this.add
        .image(screen.rect.x, screen.rect.y, TEXTURE_KEYS.roomParts, ROOM_PARTS[screen.kind])
        .setOrigin(0)
        .setDisplaySize(screen.rect.width, screen.rect.height)
        .setBlendMode(ADD)
        .setTint(colorNumber('instrument')),
    );

    // The lamps borrow the glow of the machine's own status light.
    const unit = DESIGN_WIDTH / this.scale.width;
    this.lamps = LAMPS.map((lamp) => ({
      lamp,
      image: this.add
        .image(lamp.x, lamp.y, TEXTURE_KEYS.oracleMachineParts, MACHINE_PARTS.status)
        .setScale(unit * 0.62 * lamp.size)
        .setBlendMode(ADD),
    }));

    // --- The machine, in its place, at rest until someone comes to it ---
    this.theMachine = new OracleMachine(this, MACHINE_AT.x, MACHINE_AT.y);
    this.theMachine.rest(false);

    // --- Nearest the viewer: the out-of-focus frame, and the fade into the page ---
    this.add.image(0, 0, TEXTURE_KEYS.roomFrame).setOrigin(0).setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT);

    this.drawLight();
    // The room comes up out of the page's own colour when the game first appears.
    const page = colorNumber('background');
    this.cameras.main.fadeIn(this.reducedMotion.matches ? 0 : 700, (page >> 16) & 0xff, (page >> 8) & 0xff, page & 0xff);
  }

  override update(): void {
    this.drawLight();
  }

  private drawLight(): void {
    const now = performance.now();
    const still = this.reducedMotion.matches;
    const levels = levelsAt(this.rig, now, still);
    const machine = this.theMachine;

    machine.setRoomLight(levels.onMachine);

    // --- The light map: the room's darkness, then each source's light on top of it ---
    const spill = Math.min(1, machine.emission * levels.spill);
    const spillColor = machine.emissionColor;
    const signature = [levels.ambient, levels.key, levels.fill, spill].map((level) => Math.round(level * 400)).join(':') + ':' + spillColor;
    if (signature !== this.drawn) {
      this.drawn = signature;
      const map = this.lightMap;
      const instrument = colorNumber('instrument');
      map.fill(mixColor(0x000000, instrument, levels.ambient));
      map.beginDraw();
      map.batchDrawFrame(TEXTURE_KEYS.roomFillLight, undefined, 0, 0, levels.fill, instrument);
      map.batchDrawFrame(TEXTURE_KEYS.roomKeyLight, undefined, 0, 0, levels.key, instrument);
      map.batchDrawFrame(TEXTURE_KEYS.roomSpillLight, undefined, 0, 0, spill, spillColor);
      map.endDraw();
    }

    // --- What glows by itself ---
    this.haze.setAlpha(levels.haze * levels.key * 0.55);
    this.keyFixture.setAlpha(Math.min(1, levels.key) * 0.85);
    for (const fitting of this.fillFixtures) {
      fitting.setAlpha(Math.min(1, levels.fill) * 0.75);
    }
    for (const screen of this.screens) {
      screen.setAlpha(levels.active * 0.85);
    }
    const white = mixColor(colorNumber('instrument'), colorNumber('quantumBright'), levels.quantum);
    const red = colorNumber('signalRed');
    const groups = { standby: levels.standby, active: levels.active, subsystem: levels.subsystem };
    for (const { lamp, image } of this.lamps) {
      const level = groups[lamp.group] * lampLevel(lamp, now, levels.activity, still);
      image.setAlpha(level).setVisible(level > 0.004);
      // Only the cooling line's lamps take the quantum light: they belong to what the machine is doing.
      image.setTint(lamp.red ? red : lamp.group === 'subsystem' ? white : colorNumber('instrument'));
    }
  }
}

/** The room, from any scene. */
export function theRoom(scene: Phaser.Scene): RoomScene {
  return scene.scene.get(SCENE_KEYS.room) as RoomScene;
}
