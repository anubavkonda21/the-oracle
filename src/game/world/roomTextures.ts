import type Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, FONT_STACKS, colorRgba } from '../config/designTokens';
import { createSeededRandom } from '../../utils/random';
import {
  CART_SCREEN,
  MACHINE_BOUNDS,
  RACK_A_UNITS,
  RACK_B_UNITS,
  ROOM,
  rackUnitRects,
  unitLampSpots,
  unitScreen,
  type RackUnit,
  type Rect,
} from './roomLayout';

/**
 * The laboratory, painted. Like the machine, it is procedural: drawn once
 * into textures when the game starts, from the plan in roomLayout.ts and a
 * fixed seed, so it is the same room on every load and adds nothing to the
 * download.
 *
 * The room is painted the way it would look with every light on — and then,
 * separately, the light itself is painted: for each source, a small soft
 * picture of where its light falls. The live room multiplies the one by the
 * sum of the others (see RoomScene), so the same painted room can be dark,
 * at work, or lit only by the machine, at the cost of one extra layer.
 *
 *   the room    everything in it, fully lit. Solid; drawn at up to twice the
 *               design size and no more — it is the background, and wants
 *               to be a little softer than the machine in front of it
 *   the light   three pictures, a third of the design size: where the work
 *               light falls, where the room's general light falls, and
 *               where the machine's own light falls
 *   the haze    the cone of the work light in the air
 *   the frame   out-of-focus shapes at the edges of the picture, and the
 *               fade that lets the picture meet the page around it
 *   the parts   what glows by itself: the light fittings, and the screens
 */

type Context = CanvasRenderingContext2D;

const FULL_TURN = Math.PI * 2;

/** A cool grey of a given lightness (0–1): the one hue everything in the room is made of. */
const tone = (lightness: number, alpha = 1): string =>
  `rgba(${Math.round(lightness * 224)}, ${Math.round(lightness * 237)}, ${Math.round(lightness * 255)}, ${alpha})`;
const shade = (alpha: number): string => colorRgba('void', alpha);
const white = (alpha: number): string => `rgba(255, 255, 255, ${alpha})`;

/** The most the room is ever painted at, in canvas pixels per design unit. */
export const MAX_ROOM_SCALE = 2;
/** The pictures of light are soft by nature, and are painted small. */
export const LIGHT_SCALE = 1 / 3;
const FRAME_SCALE = 1 / 4;

/** Frames of the room's parts sheet. */
export const ROOM_PARTS = {
  fixture: 'fixture',
  trace: 'screen-trace',
  readout: 'screen-readout',
  spectrum: 'screen-spectrum',
} as const;

/** Where the haze is drawn, and how large, in design units. */
export const HAZE = { x: ROOM.width / 2, y: ROOM.soffit - 6, width: 820, height: 560 } as const;

/* ---------- Small drawing tools ---------- */

type Stop = readonly [offset: number, color: string];

function linear(context: Context, x0: number, y0: number, x1: number, y1: number, stops: readonly Stop[]): CanvasGradient {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function radial(context: Context, x: number, y: number, radius: number, stops: readonly Stop[]): CanvasGradient {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function circle(context: Context, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, FULL_TURN);
}

function fill(context: Context, rect: Rect, style: string | CanvasGradient): void {
  context.fillStyle = style;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

/** Draws only the blurred shadow of a shape (see the same tool in oracleMachineTextures.ts). */
function soft(context: Context, scale: number, blur: number, color: string, draw: () => void): void {
  const far = 8192;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = blur * scale;
  context.shadowOffsetX = far;
  context.shadowOffsetY = 0;
  context.translate(-far / scale, 0);
  context.fillStyle = '#000';
  context.strokeStyle = '#000';
  draw();
  context.restore();
}

/** A flat plate with a lit upper edge and a shadowed lower one: the face of almost everything in the room. */
function plate(context: Context, rect: Rect, lightness: number, radius = 1.5): void {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  context.fillStyle = tone(lightness);
  context.fill();
  context.fillStyle = linear(context, 0, rect.y, 0, rect.y + rect.height, [
    [0, white(0.06)],
    [0.5, white(0)],
    [0.5, shade(0)],
    [1, shade(0.22)],
  ]);
  context.fill();
  context.fillStyle = tone(Math.min(1, lightness + 0.2), 0.55);
  context.fillRect(rect.x + radius, rect.y, rect.width - radius * 2, 0.8);
  context.fillStyle = shade(0.55);
  context.fillRect(rect.x + radius, rect.y + rect.height - 0.8, rect.width - radius * 2, 0.8);
}

function screw(context: Context, x: number, y: number, radius = 1.3): void {
  circle(context, x, y, radius);
  context.fillStyle = tone(0.4);
  context.fill();
  context.fillStyle = shade(0.6);
  context.fillRect(x - radius * 0.7, y - 0.25, radius * 1.4, 0.5);
}

/** The lens of an indicator lamp, unlit. The light itself is live. */
function lens(context: Context, x: number, y: number, radius = 2.1): void {
  circle(context, x, y, radius + 0.9);
  context.fillStyle = shade(0.85);
  context.fill();
  circle(context, x, y, radius);
  context.fillStyle = tone(0.2);
  context.fill();
  circle(context, x - radius * 0.3, y - radius * 0.35, radius * 0.35);
  context.fillStyle = tone(0.5, 0.6);
  context.fill();
}

function knob(context: Context, x: number, y: number, radius: number, angle: number): void {
  circle(context, x, y + 1, radius + 1);
  context.fillStyle = shade(0.6);
  context.fill();
  circle(context, x, y, radius);
  context.fillStyle = radial(context, x - radius * 0.3, y - radius * 0.4, radius * 1.6, [
    [0, tone(0.42)],
    [1, tone(0.1)],
  ]);
  context.fill();
  context.strokeStyle = tone(0.78);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + Math.cos(angle) * radius * 0.25, y + Math.sin(angle) * radius * 0.25);
  context.lineTo(x + Math.cos(angle) * radius * 0.85, y + Math.sin(angle) * radius * 0.85);
  context.stroke();
}

/** A dark recess for a screen. What is on the screen is live. */
function screenRecess(context: Context, rect: Rect): void {
  context.beginPath();
  context.roundRect(rect.x - 1.5, rect.y - 1.5, rect.width + 3, rect.height + 3, 2);
  context.fillStyle = shade(0.9);
  context.fill();
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.width, rect.height, 1);
  context.fillStyle = tone(0.07);
  context.fill();
  context.fillStyle = linear(context, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height, [
    [0, white(0.07)],
    [0.4, white(0)],
  ]);
  context.fill();
}

/** A gauge: a pale dial with a needle. */
function gauge(context: Context, x: number, y: number, radius: number, needle: number): void {
  circle(context, x, y, radius + 2);
  context.fillStyle = tone(0.12);
  context.fill();
  circle(context, x, y, radius);
  context.fillStyle = tone(0.72);
  context.fill();
  context.strokeStyle = tone(0.2);
  context.lineWidth = 0.7;
  for (let mark = 0; mark <= 8; mark += 1) {
    const angle = Math.PI * 0.8 + (mark / 8) * Math.PI * 1.4;
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * radius * 0.72, y + Math.sin(angle) * radius * 0.72);
    context.lineTo(x + Math.cos(angle) * radius * 0.92, y + Math.sin(angle) * radius * 0.92);
    context.stroke();
  }
  const angle = Math.PI * 0.8 + needle * Math.PI * 1.4;
  context.strokeStyle = COLORS.signalRed;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(angle) * radius * 0.8, y + Math.sin(angle) * radius * 0.8);
  context.stroke();
  circle(context, x, y, 1.4);
  context.fillStyle = tone(0.15);
  context.fill();
}

/** A cable or a pipe along a curve: a dark body with a line of light down it. */
function run(context: Context, width: number, lightness: number, trace: () => void): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = shade(0.75);
  context.lineWidth = width + 1.6;
  trace();
  context.stroke();
  context.strokeStyle = tone(lightness);
  context.lineWidth = width;
  trace();
  context.stroke();
  context.strokeStyle = tone(Math.min(1, lightness + 0.3), 0.5);
  context.lineWidth = Math.max(0.6, width * 0.22);
  context.save();
  context.translate(-width * 0.2, -width * 0.2);
  trace();
  context.stroke();
  context.restore();
  context.lineCap = 'butt';
}

/** A ribbed hose: a pale run with dark rings along it. */
function hose(context: Context, width: number, trace: () => void): void {
  run(context, width, 0.36, trace);
  context.strokeStyle = shade(0.55);
  context.lineWidth = width;
  context.setLineDash([1.6, 3]);
  trace();
  context.stroke();
  context.setLineDash([]);
}

function label(context: Context, text: string, x: number, y: number, size: number, style: string, spacing = 1): void {
  context.font = `600 ${size}px ${FONT_STACKS.machine}`;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.fillStyle = style;
  let cursor = x;
  for (const letter of text) {
    context.fillText(letter, cursor, y);
    cursor += context.measureText(letter).width + spacing;
  }
}

/** A tile of faint specks, so that large flat surfaces have the grain of real ones. */
function grainPattern(context: Context, seed: number, strength: number): CanvasPattern | null {
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tileContext = tile.getContext('2d');
  if (!tileContext) {
    return null;
  }
  const random = createSeededRandom(seed);
  const image = tileContext.createImageData(size, size);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const value = random() < 0.5 ? 0 : 255;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = Math.round(random() * strength * 255);
  }
  tileContext.putImageData(image, 0, 0);
  return context.createPattern(tile, 'repeat');
}

/* ---------- The room: the back wall and what is on it ---------- */

function drawWall(context: Context): void {
  const { width, floorLine, soffit, bay } = ROOM;

  context.fillStyle = linear(context, 0, soffit, 0, floorLine, [
    [0, tone(0.38)],
    [1, tone(0.31)],
  ]);
  context.fillRect(0, 0, width, floorLine);

  // Panels: the wall is clad in sheets, and no two sheets are quite the same tone.
  const seams = [-645, -480, -315, -150, 150, 315, 480, 645].map((offset) => width / 2 + offset);
  const random = createSeededRandom(3);
  let left = 0;
  for (const seam of [...seams, width]) {
    const shift = random() - 0.5;
    context.fillStyle = shift > 0 ? white(shift * 0.035) : shade(-shift * 0.14);
    context.fillRect(left, soffit, seam - left, floorLine - soffit);
    left = seam;
  }
  for (const seam of seams) {
    context.fillStyle = tone(0.1);
    context.fillRect(seam - 1, soffit, 2, floorLine - soffit);
    context.fillStyle = tone(0.5, 0.3);
    context.fillRect(seam + 1, soffit, 0.8, floorLine - soffit);
  }
  const crossSeam = 264;
  context.fillStyle = tone(0.1);
  context.fillRect(0, crossSeam - 1, width, 2);
  context.fillStyle = tone(0.5, 0.25);
  context.fillRect(0, crossSeam + 1, width, 0.8);
  for (const seam of seams) {
    for (const y of [soffit + 14, crossSeam - 12, crossSeam + 14, floorLine - 30]) {
      screw(context, seam - 9, y);
      screw(context, seam + 10, y);
    }
  }

  // The ceiling's edge, in shadow.
  context.fillStyle = linear(context, 0, 0, 0, soffit, [
    [0, tone(0.08)],
    [1, tone(0.15)],
  ]);
  context.fillRect(0, 0, width, soffit);
  context.fillStyle = shade(0.8);
  context.fillRect(0, soffit - 1, width, 2.5);
  context.fillStyle = linear(context, 0, soffit, 0, soffit + 26, [
    [0, shade(0.45)],
    [1, shade(0)],
  ]);
  context.fillRect(0, soffit, width, 26);

  // Skirting at the foot of the wall.
  fill(context, { x: 0, y: floorLine - 15, width, height: 15 }, tone(0.16));
  context.fillStyle = tone(0.46, 0.5);
  context.fillRect(0, floorLine - 15, width, 0.8);

  // The bay: a shallow recess behind the machine, ruled down both sides like an instrument.
  fill(context, bay, tone(0.275));
  context.fillStyle = linear(context, 0, bay.y, 0, bay.y + 34, [
    [0, shade(0.6)],
    [1, shade(0)],
  ]);
  context.fillRect(bay.x, bay.y, bay.width, 34);
  for (const [edge, toward] of [
    [bay.x, 1],
    [bay.x + bay.width, -1],
  ] as const) {
    context.fillStyle = linear(context, edge, 0, edge + toward * 22, 0, [
      [0, shade(0.5)],
      [1, shade(0)],
    ]);
    context.fillRect(Math.min(edge, edge + toward * 22), bay.y, 22, bay.height);
  }
  context.strokeStyle = shade(0.85);
  context.lineWidth = 2;
  context.strokeRect(bay.x, bay.y, bay.width, bay.height);
  context.strokeStyle = tone(0.5, 0.4);
  context.lineWidth = 0.8;
  context.strokeRect(bay.x - 2, bay.y - 2, bay.width + 4, bay.height + 4);
  let mark = 0;
  for (let y = bay.y + 30; y < bay.y + bay.height - 24; y += 20) {
    const long = mark % 5 === 0;
    context.fillStyle = tone(0.56, long ? 0.75 : 0.45);
    context.fillRect(bay.x + 7, y, long ? 13 : 7, 1);
    context.fillRect(bay.x + bay.width - 7 - (long ? 13 : 7), y, long ? 13 : 7, 1);
    mark += 1;
  }
  label(context, 'BAY 07', bay.x + 28, bay.y + 22, 8.5, tone(0.6, 0.8), 2.4);
  label(context, 'COLD LINE A', bay.x + bay.width - 104, bay.y + 22, 6, tone(0.55, 0.6), 1.2);
}

function drawFixtures(context: Context): void {
  for (const fixture of Object.values(ROOM.fixtures)) {
    context.beginPath();
    context.roundRect(fixture.x - 7, fixture.y - 5, fixture.width + 14, fixture.height + 9, 2);
    context.fillStyle = tone(0.06);
    context.fill();
    // The diffuser, unlit. Its light is live.
    fill(context, fixture, tone(0.3));
    context.fillStyle = linear(context, 0, fixture.y, 0, fixture.y + fixture.height, [
      [0, shade(0.3)],
      [1, white(0.06)],
    ]);
    context.fillRect(fixture.x, fixture.y, fixture.width, fixture.height);
  }
}

function drawTray(context: Context): void {
  const { width, soffit, tray } = ROOM;
  const top = tray.y;
  const bottom = tray.y + tray.height;

  // Hangers from the ceiling.
  for (let x = 96; x < width; x += 208) {
    context.fillStyle = tone(0.12);
    context.fillRect(x - 1.5, soffit, 3, bottom - soffit);
    context.fillStyle = tone(0.42, 0.4);
    context.fillRect(x - 1.5, soffit, 0.8, bottom - soffit);
  }

  // The cables lying in the tray, sagging a little between hangers.
  const random = createSeededRandom(8);
  for (let cable = 0; cable < 6; cable += 1) {
    const y = top + 4 + cable * 2.4;
    run(context, 2.4 + random() * 1.6, 0.07 + random() * 0.06, () => {
      context.beginPath();
      context.moveTo(-10, y);
      for (let x = 96; x < width + 208; x += 208) {
        context.quadraticCurveTo(x - 104, y + 3 + random() * 2.5, x, y);
      }
    });
  }

  // The tray itself: two rails and the rungs between them.
  for (let x = 8; x < width; x += 26) {
    context.fillStyle = tone(0.2);
    context.fillRect(x, top, 2, tray.height);
  }
  for (const y of [top, bottom - 3]) {
    fill(context, { x: 0, y, width, height: 3 }, tone(0.3));
    context.fillStyle = tone(0.6, 0.4);
    context.fillRect(0, y, width, 0.8);
    context.fillStyle = shade(0.6);
    context.fillRect(0, y + 3, width, 1);
  }
}

/** A bundle of cables dropping from the tray to a piece of equipment. */
function drawDrop(context: Context, x: number, toY: number, count: number, seed: number): void {
  const random = createSeededRandom(seed);
  const fromY = ROOM.tray.y + ROOM.tray.height - 2;
  for (let cable = 0; cable < count; cable += 1) {
    const startX = x + cable * 5;
    const endX = x + cable * 4.2 + (random() - 0.5) * 6;
    const sway = (random() - 0.5) * 16;
    run(context, 2.2 + random() * 1.4, 0.07 + random() * 0.07, () => {
      context.beginPath();
      context.moveTo(startX, fromY);
      context.bezierCurveTo(startX + sway, fromY + (toY - fromY) * 0.4, endX - sway, fromY + (toY - fromY) * 0.7, endX, toY + 4);
    });
  }
}

/* ---------- The racks ---------- */

function drawUnit(context: Context, unit: RackUnit, face: Rect, seed: number): void {
  const random = createSeededRandom(seed);
  plate(context, face, unit.kind === 'vent' ? 0.17 : 0.215);
  for (const [x, y] of [
    [face.x + 4, face.y + 4],
    [face.x + face.width - 4, face.y + 4],
    [face.x + 4, face.y + face.height - 4],
    [face.x + face.width - 4, face.y + face.height - 4],
  ] as const) {
    screw(context, x, y, 1.1);
  }
  const midY = face.y + face.height / 2;
  const right = face.x + face.width;
  const screen = unitScreen(unit, face);
  if (screen) {
    screenRecess(context, screen.rect);
  }

  switch (unit.kind) {
    case 'vent':
      for (let y = face.y + 8; y < face.y + face.height - 6; y += 5) {
        context.beginPath();
        context.roundRect(face.x + 14, y, face.width - 28, 2.2, 1);
        context.fillStyle = shade(0.85);
        context.fill();
        context.fillStyle = tone(0.4, 0.35);
        context.fillRect(face.x + 15, y + 2.4, face.width - 30, 0.6);
      }
      break;
    case 'source':
      for (let button = 0; button < 4; button += 1) {
        context.beginPath();
        context.roundRect(face.x + 62 + button * 11, face.y + 9, 7, 4.5, 1);
        context.fillStyle = tone(0.32);
        context.fill();
      }
      for (let dial = 0; dial < 3; dial += 1) {
        knob(context, face.x + 68 + dial * 22, face.y + 30, 6, -2.2 + random() * 2.6);
      }
      context.fillStyle = tone(0.5, 0.5);
      context.fillRect(face.x + 10, face.y + 30, 40, 0.8);
      context.fillRect(face.x + 10, face.y + 34, 26, 0.8);
      break;
    case 'patch': {
      const sockets: { x: number; y: number }[] = [];
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 9; column += 1) {
          const socket = { x: face.x + 14 + column * 13, y: face.y + 17 + row * 19 };
          sockets.push(socket);
          circle(context, socket.x, socket.y, 3.2);
          context.fillStyle = tone(0.46);
          context.fill();
          circle(context, socket.x, socket.y, 1.6);
          context.fillStyle = shade(0.9);
          context.fill();
        }
      }
      // A few leads patched between sockets, hanging in loops.
      for (let lead = 0; lead < 4; lead += 1) {
        const from = sockets[Math.floor(random() * 9)];
        const to = sockets[9 + Math.floor(random() * 9)];
        if (!from || !to) {
          continue;
        }
        run(context, 1.5, 0.5 + random() * 0.14, () => {
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.quadraticCurveTo((from.x + to.x) / 2, Math.max(from.y, to.y) + 9 + random() * 7, to.x, to.y);
        });
      }
      break;
    }
    case 'meter':
      context.beginPath();
      context.roundRect(face.x + 10, midY - 6, 28, 12, 1.5);
      context.fillStyle = tone(0.1);
      context.fill();
      context.fillStyle = tone(0.55, 0.5);
      context.fillRect(face.x + 14, midY - 2, 20, 0.8);
      context.fillRect(face.x + 14, midY + 2, 13, 0.8);
      break;
    case 'scope':
      knob(context, right - 38, face.y + 20, 6.5, -1.2);
      knob(context, right - 38, face.y + 46, 6.5, 0.4);
      for (let button = 0; button < 3; button += 1) {
        context.beginPath();
        context.roundRect(right - 22, face.y + 40 + button * 8, 12, 4.5, 1);
        context.fillStyle = tone(0.32);
        context.fill();
      }
      break;
    case 'supply':
      context.beginPath();
      context.roundRect(face.x + 46, midY - 8, 14, 16, 2);
      context.fillStyle = tone(0.08);
      context.fill();
      context.fillStyle = tone(0.4);
      context.fillRect(face.x + 48, midY - 6, 10, 6);
      for (const [x, red] of [
        [right - 44, true],
        [right - 26, false],
      ] as const) {
        circle(context, x, midY, 5.5);
        context.fillStyle = red ? colorRgba('signalRed', 0.75) : tone(0.12);
        context.fill();
        circle(context, x, midY, 2.6);
        context.fillStyle = tone(0.6);
        context.fill();
      }
      break;
    case 'blank':
      context.fillStyle = tone(0.5, 0.3);
      context.fillRect(face.x + 14, midY, face.width - 28, 0.8);
      break;
  }

  for (const spot of unitLampSpots(unit, face)) {
    lens(context, spot.x, spot.y);
  }
}

function drawRack(context: Context, rack: Rect, units: readonly RackUnit[], seed: number): void {
  // The frame, and the perforated rails the units bolt to.
  plate(context, rack, 0.115, 2);
  for (const x of [rack.x + 3, rack.x + rack.width - 9]) {
    fill(context, { x, y: rack.y + 8, width: 6, height: rack.height - 12 }, tone(0.2));
    for (let y = rack.y + 13; y < rack.y + rack.height - 8; y += 7.5) {
      circle(context, x + 3, y, 1.1);
      context.fillStyle = shade(0.9);
      context.fill();
    }
  }
  const faces = rackUnitRects(rack, units);
  units.forEach((unit, index) => {
    const face = faces[index];
    if (face) {
      drawUnit(context, unit, face, seed + index * 7);
    }
  });
  // Feet.
  for (const x of [rack.x + 14, rack.x + rack.width - 26]) {
    fill(context, { x, y: rack.y + rack.height - 3, width: 12, height: 3 }, tone(0.07));
  }
}

/* ---------- The gas panel and the cabinet ---------- */

function drawGasPanel(context: Context): void {
  const panel = ROOM.gasPanel;
  plate(context, panel, 0.2, 2);
  const pipes: (readonly [number, number, number, number])[] = [
    [panel.x + 20, ROOM.tray.y + ROOM.tray.height, panel.x + 20, panel.y + panel.height - 20],
    [panel.x + 44, ROOM.tray.y + ROOM.tray.height, panel.x + 44, panel.y + 240],
    [panel.x + 20, panel.y + 92, panel.x + 78, panel.y + 92],
    [panel.x + 44, panel.y + 168, panel.x + 78, panel.y + 168],
    [panel.x + 20, panel.y + 240, panel.x + 60, panel.y + 240],
    [panel.x + 60, panel.y + 240, panel.x + 60, ROOM.floorLine - 6],
  ];
  for (const [x0, y0, x1, y1] of pipes) {
    run(context, 4, 0.52, () => {
      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
    });
  }
  // Valves where the lines branch.
  for (const [x, y] of [
    [panel.x + 20, panel.y + 92],
    [panel.x + 44, panel.y + 168],
    [panel.x + 20, panel.y + 240],
  ] as const) {
    circle(context, x, y, 7);
    context.fillStyle = tone(0.14);
    context.fill();
    context.strokeStyle = tone(0.58);
    context.lineWidth = 1;
    context.stroke();
    context.strokeStyle = colorRgba('signalRed', 0.8);
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x - 7, y - 4);
    context.lineTo(x + 7, y + 4);
    context.stroke();
    context.lineCap = 'butt';
  }
  gauge(context, panel.x + 74, panel.y + 52, 13, 0.62);
  gauge(context, panel.x + 74, panel.y + 132, 13, 0.3);
  label(context, 'He', panel.x + 10, panel.y + 16, 8, tone(0.62, 0.8), 0.6);
  label(context, 'RETURN', panel.x + 52, panel.y + 198, 5.5, tone(0.55, 0.6), 0.8);
  lens(context, panel.x + panel.width - 14, panel.y + 16);
}

function drawCabinet(context: Context): void {
  const cabinet = ROOM.cabinet;
  // Its supply comes down from the tray in a conduit.
  run(context, 6, 0.32, () => {
    context.beginPath();
    context.moveTo(cabinet.x + 30, ROOM.tray.y + ROOM.tray.height);
    context.lineTo(cabinet.x + 30, cabinet.y + 2);
  });
  plate(context, cabinet, 0.19, 2);
  context.fillStyle = shade(0.75);
  context.fillRect(cabinet.x + 62, cabinet.y + 6, 1.2, cabinet.height - 12);
  context.beginPath();
  context.roundRect(cabinet.x + 68, cabinet.y + 96, 5, 30, 2);
  context.fillStyle = tone(0.5);
  context.fill();
  // The warning every such cabinet carries: a triangle, and a bolt.
  const x = cabinet.x + 30;
  const y = cabinet.y + 74;
  context.strokeStyle = tone(0.74, 0.85);
  context.lineWidth = 1.4;
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x, y - 13);
  context.lineTo(x + 13, y + 10);
  context.lineTo(x - 13, y + 10);
  context.closePath();
  context.stroke();
  context.beginPath();
  context.moveTo(x + 2, y - 6);
  context.lineTo(x - 3, y + 2);
  context.lineTo(x + 2, y + 2);
  context.lineTo(x - 2, y + 8);
  context.stroke();
  // Its rating plate.
  fill(context, { x: cabinet.x + 12, y: cabinet.y + 150, width: 38, height: 22 }, tone(0.3));
  for (let line = 0; line < 3; line += 1) {
    context.fillStyle = shade(0.6);
    context.fillRect(cabinet.x + 16, cabinet.y + 156 + line * 5, line === 2 ? 18 : 30, 0.9);
  }
  lens(context, cabinet.x + 16, cabinet.y + 18);
}

/* ---------- What serves the machine: the pump and the cryostat ---------- */

/** A cylinder of turned metal, lit from the left. */
function steel(context: Context, rect: Rect, brightness: number): void {
  context.fillStyle = linear(context, rect.x, 0, rect.x + rect.width, 0, [
    [0, tone(0.2 * brightness)],
    [0.18, tone(0.52 * brightness)],
    [0.34, tone(0.7 * brightness)],
    [0.55, tone(0.42 * brightness)],
    [0.82, tone(0.22 * brightness)],
    [1, tone(0.12 * brightness)],
  ]);
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawPump(context: Context): void {
  const pump = ROOM.pump;
  const centre = pump.x + pump.width / 2;

  // Its stand.
  for (const x of [pump.x + 12, pump.x + pump.width - 18]) {
    fill(context, { x, y: pump.y + 126, width: 6, height: pump.height - 126 }, tone(0.14));
  }
  fill(context, { x: pump.x + 4, y: pump.y + pump.height - 6, width: pump.width - 8, height: 6 }, tone(0.1));

  // The line up to the tray, through a gate valve.
  run(context, 7, 0.4, () => {
    context.beginPath();
    context.moveTo(centre, ROOM.tray.y + ROOM.tray.height);
    context.lineTo(centre, pump.y + 26);
  });
  plate(context, { x: centre - 15, y: pump.y - 6, width: 30, height: 18 }, 0.24, 2);
  knob(context, centre, pump.y + 3, 5, -0.8);

  // The body: a finned cylinder under a bolted flange.
  const body = { x: pump.x + 12, y: pump.y + 36, width: pump.width - 24, height: 88 };
  steel(context, body, 0.8);
  for (let y = body.y + 6; y < body.y + body.height - 4; y += 6) {
    context.fillStyle = shade(0.5);
    context.fillRect(body.x, y, body.width, 1.4);
    context.fillStyle = white(0.07);
    context.fillRect(body.x, y + 1.4, body.width, 0.7);
  }
  const flange = { x: pump.x + 5, y: pump.y + 26, width: pump.width - 10, height: 10 };
  steel(context, flange, 1);
  for (let bolt = 0; bolt < 6; bolt += 1) {
    screw(context, flange.x + 8 + bolt * ((flange.width - 16) / 5), flange.y + 5, 1.5);
  }

  // Its controller.
  plate(context, { x: pump.x + 14, y: pump.y + 134, width: pump.width - 28, height: 30 }, 0.19, 2);
  screenRecess(context, { x: pump.x + 20, y: pump.y + 140, width: 22, height: 9 });
  lens(context, centre, pump.y + pump.height - 22);

  // The hose that joins the pump to the machine.
  hose(context, 10, () => {
    context.beginPath();
    context.moveTo(body.x + body.width - 2, pump.y + 72);
    context.bezierCurveTo(pump.x + pump.width + 14, pump.y + 70, MACHINE_BOUNDS.x - 22, pump.y + 40, MACHINE_BOUNDS.x + 6, pump.y + 46);
  });
}

function drawCryostat(context: Context): void {
  const cryostat = ROOM.cryostat;
  const controls = ROOM.cryostatControls;
  const centre = cryostat.x + cryostat.width / 2;

  // The frame it hangs in.
  for (const x of [cryostat.x - 7, cryostat.x + cryostat.width + 1]) {
    fill(context, { x, y: cryostat.y - 12, width: 6, height: ROOM.floorLine - cryostat.y + 12 }, tone(0.15));
    context.fillStyle = tone(0.5, 0.35);
    context.fillRect(x, cryostat.y - 12, 0.9, ROOM.floorLine - cryostat.y + 12);
  }
  plate(context, { x: cryostat.x - 9, y: cryostat.y - 14, width: cryostat.width + 18, height: 10 }, 0.17, 1);

  // Its lines, up to the tray.
  for (const [offset, width] of [
    [-22, 4],
    [0, 7],
    [22, 4],
  ] as const) {
    run(context, width, 0.5, () => {
      context.beginPath();
      context.moveTo(centre + offset, ROOM.tray.y + ROOM.tray.height);
      context.lineTo(centre + offset, cryostat.y + 10);
    });
  }

  // The top plate.
  const top = { x: cryostat.x + 1, y: cryostat.y + 8, width: cryostat.width - 2, height: 10 };
  steel(context, top, 1);
  for (let bolt = 0; bolt < 7; bolt += 1) {
    screw(context, top.x + 7 + bolt * ((top.width - 14) / 6), top.y + 5, 1.4);
  }

  // The can: brushed steel, the brightest thing in the room after the machine's own light.
  const can = { x: cryostat.x + 8, y: cryostat.y + 18, width: cryostat.width - 16, height: 262 };
  steel(context, can, 0.92);
  const random = createSeededRandom(41);
  for (let x = can.x; x < can.x + can.width; x += 1.5) {
    const shift = random() - 0.5;
    context.fillStyle = shift > 0 ? white(shift * 0.07) : shade(-shift * 0.2);
    context.fillRect(x, can.y, 1.5, can.height);
  }
  // Its rounded end, and the tail below it.
  context.save();
  context.beginPath();
  context.ellipse(centre, can.y + can.height, can.width / 2, 17, 0, 0, Math.PI);
  context.clip();
  steel(context, { x: can.x, y: can.y + can.height, width: can.width, height: 18 }, 0.8);
  context.fillStyle = linear(context, 0, can.y + can.height, 0, can.y + can.height + 17, [
    [0, shade(0)],
    [1, shade(0.6)],
  ]);
  context.fillRect(can.x, can.y + can.height, can.width, 18);
  context.restore();

  // Two stage flanges, each a little colder than the last.
  for (const [y, name] of [
    [cryostat.y + 70, '50 K'],
    [cryostat.y + 124, '4 K'],
  ] as const) {
    const ring = { x: cryostat.x + 3, y, width: cryostat.width - 6, height: 12 };
    steel(context, ring, 1);
    context.fillStyle = white(0.25);
    context.fillRect(ring.x, ring.y, ring.width, 0.9);
    context.fillStyle = shade(0.6);
    context.fillRect(ring.x, ring.y + ring.height, ring.width, 3);
    label(context, name, can.x + 8, y - 5, 6, shade(0.75), 0.6);
    lens(context, centre, y + 8);
  }

  // The hose that joins it to the machine.
  hose(context, 10, () => {
    context.beginPath();
    context.moveTo(can.x + 3, cryostat.y + 220);
    context.bezierCurveTo(can.x - 20, cryostat.y + 222, MACHINE_BOUNDS.x + MACHINE_BOUNDS.width + 24, cryostat.y + 196, MACHINE_BOUNDS.x + MACHINE_BOUNDS.width - 6, cryostat.y + 204);
  });

  // The controls at its foot.
  plate(context, controls, 0.18, 2);
  screenRecess(context, { x: controls.x + 8, y: controls.y + 20, width: 30, height: 9 });
  knob(context, controls.x + controls.width - 13, controls.y + 21, 5, 0.9);
  for (let lamp = 0; lamp < 3; lamp += 1) {
    lens(context, controls.x + 14 + lamp * 14, controls.y + 12);
  }
}

/* ---------- The floor, and what stands on it ---------- */

function drawFloor(context: Context): void {
  const { width, height, floorLine, vanishing } = ROOM;

  context.fillStyle = linear(context, 0, floorLine, 0, height, [
    [0, tone(0.27)],
    [0.22, tone(0.225)],
    [1, tone(0.15)],
  ]);
  context.fillRect(0, floorLine, width, height - floorLine);

  // A sealed floor: it takes a reflection of the wall along its far edge.
  context.fillStyle = linear(context, 0, floorLine, 0, floorLine + 110, [
    [0, tone(0.36, 0.3)],
    [1, tone(0.36, 0)],
  ]);
  context.fillRect(0, floorLine, width, 110);

  // Joints, running away to eye level and across.
  const depth = (y: number): number => (y - vanishing.y) / (height - vanishing.y);
  context.lineWidth = 1;
  for (let x = -1800; x <= width + 1800; x += 200) {
    const farX = vanishing.x + (x - vanishing.x) * depth(floorLine);
    context.strokeStyle = shade(0.4);
    context.beginPath();
    context.moveTo(farX, floorLine);
    context.lineTo(x, height);
    context.stroke();
    context.strokeStyle = white(0.03);
    context.beginPath();
    context.moveTo(farX + 1, floorLine);
    context.lineTo(x + 2, height);
    context.stroke();
  }
  for (let step = 0, y = floorLine + 16; y < height; step += 1, y = floorLine + 16 * 1.62 ** step) {
    context.fillStyle = shade(0.36);
    context.fillRect(0, y, width, 1);
    context.fillStyle = white(0.028);
    context.fillRect(0, y + 1, width, 0.8);
  }

  // The line nobody steps over while the machine is running: marked on the floor, corners first.
  const near = 596;
  const far = 512;
  const halfFar = 308;
  const halfNear = (halfFar * depth(near)) / depth(far);
  const corners = [
    { x: vanishing.x - halfFar, y: far },
    { x: vanishing.x + halfFar, y: far },
    { x: vanishing.x + halfNear, y: near },
    { x: vanishing.x - halfNear, y: near },
  ];
  context.strokeStyle = tone(0.66, 0.5);
  context.lineCap = 'square';
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    const previous = corners[(index + corners.length - 1) % corners.length];
    if (!next || !previous) {
      return;
    }
    for (const other of [next, previous]) {
      const length = Math.hypot(other.x - corner.x, other.y - corner.y);
      const reach = Math.min(0.5, 46 / length);
      context.lineWidth = corner.y === near ? 2.4 : 1.4;
      context.beginPath();
      context.moveTo(corner.x, corner.y);
      context.lineTo(corner.x + (other.x - corner.x) * reach, corner.y + (other.y - corner.y) * reach);
      context.stroke();
    }
  });
  context.lineCap = 'butt';
  // And ticked along its near edge.
  for (let tick = 1; tick < 12; tick += 1) {
    const x = vanishing.x - halfNear + (tick / 12) * halfNear * 2;
    context.fillStyle = tone(0.66, 0.32);
    context.fillRect(x - 6, near - 1, 12, 2);
  }
}

/** A cover over the cables that cross the floor from a rack to the dais. */
function drawCableCover(context: Context, fromX: number, toX: number): void {
  const { floorLine, dais } = ROOM;
  const direction = Math.sign(toX - fromX);
  context.beginPath();
  context.moveTo(fromX, floorLine + 2);
  context.lineTo(fromX + direction * 44, floorLine + 2);
  context.lineTo(toX, dais.frontY + 2);
  context.lineTo(toX - direction * 26, dais.faceBottom + 6);
  context.closePath();
  context.fillStyle = tone(0.1);
  context.fill();
  context.strokeStyle = tone(0.4, 0.4);
  context.lineWidth = 0.8;
  context.stroke();
  for (let rib = 1; rib < 9; rib += 1) {
    const along = rib / 9;
    const x = fromX + direction * 22 + (toX - direction * 13 - fromX - direction * 22) * along;
    const y = floorLine + 2 + (dais.frontY + 3 - floorLine) * along;
    context.fillStyle = tone(0.34, 0.5);
    context.fillRect(x - 6 - along * 6, y, 12 + along * 12, 0.9);
  }
}

function drawDais(context: Context, scale: number): void {
  const { dais } = ROOM;

  soft(context, scale, 14, shade(0.9), () => {
    context.beginPath();
    context.ellipse(ROOM.width / 2, dais.faceBottom + 2, (dais.frontRight - dais.frontLeft) * 0.53, 9, 0, 0, FULL_TURN);
    context.fill();
  });

  // The top, seen from a little above.
  context.beginPath();
  context.moveTo(dais.backLeft, dais.backY);
  context.lineTo(dais.backRight, dais.backY);
  context.lineTo(dais.frontRight, dais.frontY);
  context.lineTo(dais.frontLeft, dais.frontY);
  context.closePath();
  context.fillStyle = linear(context, 0, dais.backY, 0, dais.frontY, [
    [0, tone(0.15)],
    [1, tone(0.24)],
  ]);
  context.fill();
  // Tread plate: fine lines across it.
  context.save();
  context.clip();
  for (let y = dais.backY + 4; y < dais.frontY; y += 4) {
    context.fillStyle = shade(0.25);
    context.fillRect(dais.frontLeft, y, dais.frontRight - dais.frontLeft, 0.8);
  }
  context.restore();

  // The front face, and the bright edge where the two meet.
  context.beginPath();
  context.moveTo(dais.frontLeft, dais.frontY);
  context.lineTo(dais.frontRight, dais.frontY);
  context.lineTo(dais.frontRight - 3, dais.faceBottom);
  context.lineTo(dais.frontLeft + 3, dais.faceBottom);
  context.closePath();
  context.fillStyle = linear(context, 0, dais.frontY, 0, dais.faceBottom, [
    [0, tone(0.15)],
    [1, tone(0.08)],
  ]);
  context.fill();
  context.fillStyle = tone(0.7, 0.85);
  context.fillRect(dais.frontLeft, dais.frontY - 0.8, dais.frontRight - dais.frontLeft, 1.6);
  for (const x of [dais.frontLeft + 14, dais.frontRight - 14, dais.frontLeft + 250, dais.frontRight - 250]) {
    screw(context, x, dais.frontY + 8, 1.6);
  }
  for (let lamp = 0; lamp < 4; lamp += 1) {
    const along = (lamp + 0.5) / 4;
    lens(context, dais.frontLeft + 60 + along * (dais.frontRight - dais.frontLeft - 120), dais.frontY + 8, 2.4);
  }
}

function drawCompressor(context: Context, scale: number): void {
  const unit = ROOM.compressor;

  soft(context, scale, 12, shade(0.85), () => {
    context.fillRect(unit.x - 4, unit.y + unit.height - 6, unit.width + 8, 14);
  });
  // Its lines run back to the gas panel.
  for (const offset of [0, 16]) {
    hose(context, 7, () => {
      context.beginPath();
      context.moveTo(unit.x + 40 + offset, unit.y + 16);
      context.bezierCurveTo(unit.x + 30 + offset, unit.y - 40, ROOM.gasPanel.x + 70, ROOM.floorLine + 34, ROOM.gasPanel.x + 60, ROOM.floorLine - 4);
    });
  }
  // The top, seen from above, then the front.
  context.beginPath();
  context.moveTo(unit.x + 16, unit.y);
  context.lineTo(unit.x + unit.width - 6, unit.y);
  context.lineTo(unit.x + unit.width, unit.y + 18);
  context.lineTo(unit.x, unit.y + 18);
  context.closePath();
  context.fillStyle = tone(0.24);
  context.fill();
  plate(context, { x: unit.x, y: unit.y + 18, width: unit.width, height: unit.height - 24 }, 0.17, 2);
  for (let x = unit.x + 16; x < unit.x + 118; x += 7) {
    context.beginPath();
    context.roundRect(x, unit.y + 34, 3, unit.height - 58, 1.5);
    context.fillStyle = shade(0.85);
    context.fill();
  }
  gauge(context, unit.x + unit.width - 56, unit.y + 60, 14, 0.55);
  knob(context, unit.x + unit.width - 24, unit.y + 60, 6, 2.2);
  fill(context, { x: unit.x + 132, y: unit.y + 92, width: 78, height: 16 }, tone(0.28));
  label(context, 'HE COMPRESSOR', unit.x + 137, unit.y + 103, 6, shade(0.8), 0.7);
  for (const x of [unit.x + 12, unit.x + unit.width - 30]) {
    fill(context, { x, y: unit.y + unit.height - 6, width: 18, height: 6 }, tone(0.06));
  }
}

function drawCart(context: Context, scale: number): void {
  const cart = ROOM.cart;

  soft(context, scale, 12, shade(0.85), () => {
    context.fillRect(cart.x - 2, cart.y + cart.height - 6, cart.width + 4, 14);
  });
  // The frame: four legs and two shelves.
  for (const x of [cart.x, cart.x + cart.width - 5]) {
    fill(context, { x, y: cart.y + 60, width: 5, height: cart.height - 68 }, tone(0.26));
  }
  for (const y of [cart.y + 70, cart.y + 138]) {
    plate(context, { x: cart.x - 3, y, width: cart.width + 6, height: 6 }, 0.25, 1);
  }
  for (const x of [cart.x + 8, cart.x + cart.width - 8]) {
    circle(context, x, cart.y + cart.height - 6, 6.5);
    context.fillStyle = tone(0.07);
    context.fill();
    circle(context, x, cart.y + cart.height - 6, 2.2);
    context.fillStyle = tone(0.34);
    context.fill();
  }
  // The instrument on the top shelf.
  const box = { x: cart.x + 8, y: cart.y + 6, width: cart.width - 16, height: 64 };
  plate(context, box, 0.2, 2);
  screenRecess(context, CART_SCREEN.rect);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      knob(context, cart.x + 108 + column * 17, cart.y + 26 + row * 22, 5, -2 + row * 1.3 + column * 0.8);
    }
  }
  lens(context, cart.x + cart.width - 26, cart.y + 24);
  lens(context, cart.x + cart.width - 26, cart.y + 40);
  // Below: a coil of cable, and a box of spares.
  context.strokeStyle = tone(0.08);
  context.lineWidth = 4;
  for (let loop = 0; loop < 3; loop += 1) {
    context.beginPath();
    context.ellipse(cart.x + 56, cart.y + 124 - loop * 4, 34, 9, 0, 0, FULL_TURN);
    context.stroke();
  }
  plate(context, { x: cart.x + 112, y: cart.y + 98, width: 62, height: 40 }, 0.16, 2);
  // Its lead runs back to the rack behind it.
  run(context, 3, 0.09, () => {
    context.beginPath();
    context.moveTo(box.x + box.width - 30, box.y + 2);
    context.bezierCurveTo(box.x + box.width - 20, box.y - 50, ROOM.rackB.x + 150, ROOM.floorLine + 36, ROOM.rackB.x + 120, ROOM.floorLine - 2);
  });
}

function drawRoom(context: Context, scale: number): void {
  drawWall(context);
  drawFixtures(context);
  drawTray(context);
  drawDrop(context, ROOM.rackA.x + 46, ROOM.rackA.y, 5, 51);
  drawDrop(context, ROOM.rackA.x + 112, ROOM.rackA.y, 3, 52);
  drawDrop(context, ROOM.rackB.x + 30, ROOM.rackB.y, 4, 53);
  drawDrop(context, ROOM.rackB.x + 108, ROOM.rackB.y, 4, 54);
  drawGasPanel(context);
  drawCabinet(context);
  drawRack(context, ROOM.rackA, RACK_A_UNITS, 100);
  drawRack(context, ROOM.rackB, RACK_B_UNITS, 200);
  drawFloor(context);
  drawCableCover(context, ROOM.rackA.x + 96, ROOM.dais.frontLeft + 14);
  drawCableCover(context, ROOM.rackB.x + 76, ROOM.dais.frontRight - 14);
  drawPump(context);
  drawCryostat(context);
  drawDais(context, scale);
  drawCompressor(context, scale);
  drawCart(context, scale);

  // The grain of real surfaces, over all of it.
  const surface = grainPattern(context, 23, 0.045);
  if (surface) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = surface;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
  }
}

/* ---------- The light: where each source's light falls ---------- */

function ellipseGlow(context: Context, x: number, y: number, radiusX: number, radiusY: number, stops: readonly Stop[]): void {
  context.save();
  context.translate(x, y);
  context.scale(1, radiusY / radiusX);
  context.fillStyle = radial(context, 0, 0, radiusX, stops);
  context.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
  context.restore();
}

const wallOnly = (context: Context): void => {
  context.beginPath();
  context.rect(0, 0, ROOM.width, ROOM.floorLine);
  context.clip();
};
const floorOnly = (context: Context): void => {
  context.beginPath();
  context.rect(0, ROOM.floorLine, ROOM.width, ROOM.height - ROOM.floorLine);
  context.clip();
};

function daisTop(context: Context): void {
  const { dais } = ROOM;
  context.beginPath();
  context.moveTo(dais.backLeft, dais.backY);
  context.lineTo(dais.backRight, dais.backY);
  context.lineTo(dais.frontRight, dais.frontY);
  context.lineTo(dais.frontLeft, dais.frontY);
  context.closePath();
}

/** Takes light away, softly, wherever `draw` paints: a shadow. */
function shadow(context: Context, scale: number, blur: number, strength: number, draw: () => void): void {
  context.save();
  context.globalCompositeOperation = 'destination-out';
  soft(context, scale, blur, `rgba(0, 0, 0, ${strength})`, draw);
  context.restore();
}

/** The work light: a cone from the fitting over the machine, onto the wall behind it and the floor round it. */
function drawKeyLight(context: Context, scale: number): void {
  const { width, floorLine, tray, rackA, rackB, pump, cryostat } = ROOM;
  const centre = width / 2;

  context.save();
  wallOnly(context);
  ellipseGlow(context, centre, 44, 600, 640, [
    [0, white(0.96)],
    [0.22, white(0.84)],
    [0.45, white(0.56)],
    [0.7, white(0.22)],
    [1, white(0)],
  ]);
  context.restore();

  context.save();
  floorOnly(context);
  ellipseGlow(context, centre, floorLine + 76, 600, 220, [
    [0, white(0.86)],
    [0.35, white(0.54)],
    [0.7, white(0.18)],
    [1, white(0)],
  ]);
  context.restore();
  daisTop(context);
  context.fillStyle = white(0.2);
  context.fill();

  // What stands in the light throws a shadow away from it: the machine onto the wall behind and below it,
  // the tray onto the wall beneath it, and each piece of equipment outward, away from the centre of the room.
  shadow(context, scale, 18, 0.28, () => {
    context.beginPath();
    context.roundRect(MACHINE_BOUNDS.x + 6, MACHINE_BOUNDS.y + 30, MACHINE_BOUNDS.width - 12, MACHINE_BOUNDS.height + 4, 12);
    context.fill();
  });
  shadow(context, scale, 9, 0.42, () => {
    context.fillRect(0, tray.y + tray.height, width, 12);
  });
  shadow(context, scale, 20, 0.5, () => {
    context.fillRect(rackA.x - 50, rackA.y + 14, 62, rackA.height);
    context.fillRect(rackB.x + rackB.width - 12, rackB.y + 14, 62, rackB.height);
    context.fillRect(pump.x - 26, pump.y + 30, 34, pump.height - 30);
    context.fillRect(cryostat.x + cryostat.width - 6, cryostat.y + 20, 34, cryostat.height - 20);
  });
}

/** The room's general light: even, from the fittings at either side, thinning toward the floor and the corners. */
function drawFillLight(context: Context, scale: number): void {
  const { width, height, floorLine, fixtures, rackA, rackB, bay, dais } = ROOM;

  context.fillStyle = linear(context, 0, 0, 0, floorLine, [
    [0, white(0.86)],
    [1, white(0.6)],
  ]);
  context.fillRect(0, 0, width, floorLine);
  context.fillStyle = linear(context, 0, floorLine, 0, height, [
    [0, white(0.6)],
    [1, white(0.3)],
  ]);
  context.fillRect(0, floorLine, width, height - floorLine);
  for (const fixture of [fixtures.fillLeft, fixtures.fillRight]) {
    ellipseGlow(context, fixture.x + fixture.width / 2, fixture.y + 10, 430, 380, [
      [0, white(0.3)],
      [1, white(0)],
    ]);
  }

  // Where light does not get to: behind and under things, into the bay, and the corners of the floor.
  shadow(context, scale, 12, 0.32, () => {
    context.fillRect(0, floorLine - 10, width, 22);
  });
  shadow(context, scale, 16, 0.34, () => {
    context.fillRect(rackA.x - 12, rackA.y - 6, rackA.width + 24, rackA.height + 12);
    context.fillRect(rackB.x - 12, rackB.y - 6, rackB.width + 24, rackB.height + 12);
    context.fillRect(dais.frontLeft, dais.frontY + 4, dais.frontRight - dais.frontLeft, 30);
  });
  shadow(context, scale, 30, 0.16, () => {
    context.fillRect(bay.x, bay.y, bay.width, bay.height);
  });
  shadow(context, scale, 90, 0.5, () => {
    context.beginPath();
    context.ellipse(0, height, 260, 190, 0, 0, FULL_TURN);
    context.ellipse(width, height, 260, 190, 0, 0, FULL_TURN);
    context.fill();
  });
}

/** The machine's own light: forward across the floor, back off the wall round it, and onto whatever faces it. */
function drawSpillLight(context: Context, scale: number): void {
  const { width, floorLine, pump, cryostat, rackA, rackB } = ROOM;
  const centre = width / 2;
  const eyeY = MACHINE_BOUNDS.y + MACHINE_BOUNDS.height * 0.47;

  context.save();
  wallOnly(context);
  ellipseGlow(context, centre, eyeY, 620, 420, [
    [0, white(0.5)],
    [0.42, white(0.3)],
    [0.75, white(0.09)],
    [1, white(0)],
  ]);
  context.restore();

  context.save();
  floorOnly(context);
  ellipseGlow(context, centre, floorLine + 96, 660, 280, [
    [0, white(0.96)],
    [0.3, white(0.6)],
    [0.65, white(0.2)],
    [1, white(0)],
  ]);
  // The eye itself, reflected in the floor as a long streak.
  ellipseGlow(context, centre, floorLine + 150, 74, 210, [
    [0, white(0.5)],
    [1, white(0)],
  ]);
  context.restore();
  daisTop(context);
  context.fillStyle = white(0.5);
  context.fill();

  // The sides of the equipment that are turned toward the machine.
  context.save();
  soft(context, scale, 8, white(0.55), () => {
    context.fillRect(pump.x + pump.width - 20, pump.y + 26, 16, 110);
    context.fillRect(cryostat.x + 8, cryostat.y + 24, 18, 250);
  });
  soft(context, scale, 10, white(0.34), () => {
    context.fillRect(rackA.x + rackA.width - 18, rackA.y + 8, 16, rackA.height - 12);
    context.fillRect(rackB.x + 2, rackB.y + 8, 16, rackB.height - 12);
  });
  context.restore();
}

/** Breaks up the bands that smooth, dark gradients show on most screens. */
function dither(context: Context, seed: number): void {
  const { width, height } = context.canvas;
  const image = context.getImageData(0, 0, width, height);
  const random = createSeededRandom(seed);
  for (let offset = 3; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset] ?? 0;
    if (alpha > 0 && alpha < 255) {
      image.data[offset] = Math.max(0, Math.min(255, alpha + Math.round((random() - 0.5) * 5)));
    }
  }
  context.putImageData(image, 0, 0);
}

/* ---------- The haze, the frame and the parts ---------- */

function drawHaze(context: Context, width: number, height: number): void {
  // A cone of lit air, widening as it falls from the fitting.
  context.save();
  context.translate(width / 2, 0);
  context.scale(width / 2 / height, 1);
  context.fillStyle = radial(context, 0, 0, height, [
    [0, white(0.6)],
    [0.3, white(0.3)],
    [0.7, white(0.08)],
    [1, white(0)],
  ]);
  context.fillRect(-height, 0, height * 2, height);
  context.restore();
  // It is brightest down its middle.
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = linear(context, 0, 0, width, 0, [
    [0, white(0)],
    [0.5, white(1)],
    [1, white(0)],
  ]);
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';
}

/**
 * The frame: what is nearest the viewer, and so out of focus — the edge of a
 * rack to the left, of a partition to the right, the corner of a bench below —
 * and, outside those, a fade into the colour of the page so that the picture
 * has no edge.
 */
function drawFrame(context: Context, scale: number): void {
  const { width, height } = ROOM;
  const dark = colorRgba('background', 0.98);

  context.fillStyle = linear(context, 0, 0, 0, 80, [
    [0, shade(0.8)],
    [1, shade(0)],
  ]);
  context.fillRect(0, 0, width, 80);

  soft(context, scale, 9, dark, () => {
    // Left: the side of a rack, close by — it stops short of the ceiling. It is kept clear of the gas panel behind it.
    context.beginPath();
    context.roundRect(-60, 70, 74, height, 12);
    context.fill();
    // Right: the edge of a partition, floor to ceiling, kept clear of the cabinet behind it.
    context.fillRect(width - 16, -20, 60, height + 40);
    // Below: the corners of the benches the viewer stands between.
    context.beginPath();
    context.moveTo(-20, 806);
    context.lineTo(176, 846);
    context.lineTo(250, height + 20);
    context.lineTo(-20, height + 20);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(width + 20, 818);
    context.lineTo(width - 150, 852);
    context.lineTo(width - 214, height + 20);
    context.lineTo(width + 20, height + 20);
    context.closePath();
    context.fill();
  });
  // The partition is glass: one thin line of light down it.
  soft(context, scale, 4, colorRgba('instrument', 0.16), () => {
    context.fillRect(width - 22, 60, 2, height - 240);
  });

  // The fade into the page.
  const page = (alpha: number): string => colorRgba('background', alpha);
  const reach = 64;
  for (const [x0, y0, x1, y1, rect] of [
    [0, 0, reach, 0, { x: 0, y: 0, width: reach, height }],
    [width, 0, width - reach, 0, { x: width - reach, y: 0, width: reach, height }],
    [0, 0, 0, reach, { x: 0, y: 0, width, height: reach }],
    [0, height, 0, height - reach, { x: 0, y: height - reach, width, height: reach }],
  ] as const) {
    fill(context, rect, linear(context, x0, y0, x1, y1, [
      [0, page(1)],
      [0.3, page(0.78)],
      [1, page(0)],
    ]));
  }
}

interface PartPlan {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Draws the part with the origin at the top-left corner of its frame. */
  readonly draw: (context: Context, scale: number) => void;
}

/** How far a light fitting's glow reaches past the fitting itself, in design units. */
export const FIXTURE_GLOW = 26;

function partPlans(): PartPlan[] {
  const fixture = ROOM.fixtures.key;
  return [
    {
      // A light fitting, lit: the diffuser, and the glow round it. Stretched to fit each fitting.
      name: ROOM_PARTS.fixture,
      width: fixture.width + FIXTURE_GLOW * 2,
      height: fixture.height + FIXTURE_GLOW * 2,
      draw: (context, scale) => {
        context.save();
        context.shadowColor = white(0.8);
        context.shadowBlur = 14 * scale;
        context.fillStyle = white(1);
        context.fillRect(FIXTURE_GLOW, FIXTURE_GLOW, fixture.width, fixture.height);
        context.fillRect(FIXTURE_GLOW, FIXTURE_GLOW, fixture.width, fixture.height);
        context.restore();
      },
    },
    {
      // A scope: a signal crossing a graticule.
      name: ROOM_PARTS.trace,
      width: 78,
      height: 52,
      draw: (context) => {
        context.strokeStyle = white(0.18);
        context.lineWidth = 0.5;
        for (let x = 13; x < 78; x += 13) {
          context.beginPath();
          context.moveTo(x, 2);
          context.lineTo(x, 50);
          context.stroke();
        }
        for (let y = 13; y < 52; y += 13) {
          context.beginPath();
          context.moveTo(2, y);
          context.lineTo(76, y);
          context.stroke();
        }
        const random = createSeededRandom(61);
        context.strokeStyle = white(0.95);
        context.lineWidth = 1.2;
        context.beginPath();
        for (let x = 2; x <= 76; x += 1) {
          const y = 26 - Math.sin(x * 0.22) * 13 * Math.exp(-((x - 30) ** 2) / 1500) + (random() - 0.5) * 2.4;
          if (x === 2) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      },
    },
    {
      // A source's readout: a frequency.
      name: ROOM_PARTS.readout,
      width: 44,
      height: 14,
      draw: (context) => {
        context.font = `600 9px ${FONT_STACKS.machine}`;
        context.textBaseline = 'middle';
        context.textAlign = 'right';
        context.fillStyle = white(0.95);
        context.fillText('4.8120', 41, 7.5);
      },
    },
    {
      // A spectrum: a noise floor, and peaks standing out of it.
      name: ROOM_PARTS.spectrum,
      width: 74,
      height: 46,
      draw: (context) => {
        const random = createSeededRandom(67);
        context.strokeStyle = white(0.16);
        context.lineWidth = 0.5;
        for (let y = 11; y < 46; y += 11) {
          context.beginPath();
          context.moveTo(2, y);
          context.lineTo(72, y);
          context.stroke();
        }
        context.strokeStyle = white(0.95);
        context.lineWidth = 1.1;
        context.beginPath();
        for (let x = 2; x <= 72; x += 1) {
          const peaks = 26 * Math.exp(-((x - 24) ** 2) / 5) + 17 * Math.exp(-((x - 50) ** 2) / 4);
          const y = 38 - peaks - random() * 4;
          if (x === 2) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      },
    },
  ];
}

function createCanvasTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
): Phaser.Textures.CanvasTexture {
  const texture = textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!texture) {
    throw new Error(`Could not create the canvas texture "${key}".`);
  }
  return texture;
}

/**
 * Paints the laboratory's textures. `resolution` is the game's render
 * resolution; the room is painted at that, up to MAX_ROOM_SCALE. The web
 * fonts must be loaded first: there is lettering on the equipment.
 */
export function createRoomTextures(textures: Phaser.Textures.TextureManager, resolution: number): void {
  if (textures.exists(TEXTURE_KEYS.room)) {
    return;
  }
  const { width, height } = ROOM;
  const scale = Math.min(resolution, MAX_ROOM_SCALE);

  const room = createCanvasTexture(textures, TEXTURE_KEYS.room, width * scale, height * scale);
  room.context.scale(scale, scale);
  drawRoom(room.context, scale);
  room.refresh();

  const lights: (readonly [string, (context: Context, scale: number) => void, number])[] = [
    [TEXTURE_KEYS.roomKeyLight, drawKeyLight, 71],
    [TEXTURE_KEYS.roomFillLight, drawFillLight, 73],
    [TEXTURE_KEYS.roomSpillLight, drawSpillLight, 79],
  ];
  for (const [key, draw, seed] of lights) {
    const light = createCanvasTexture(textures, key, width * LIGHT_SCALE, height * LIGHT_SCALE);
    light.context.save();
    light.context.scale(LIGHT_SCALE, LIGHT_SCALE);
    draw(light.context, LIGHT_SCALE);
    light.context.restore();
    dither(light.context, seed);
    light.refresh();
  }

  const haze = createCanvasTexture(textures, TEXTURE_KEYS.roomHaze, 256, 176);
  drawHaze(haze.context, 256, 176);
  haze.refresh();

  const frame = createCanvasTexture(textures, TEXTURE_KEYS.roomFrame, width * FRAME_SCALE, height * FRAME_SCALE);
  frame.context.scale(FRAME_SCALE, FRAME_SCALE);
  drawFrame(frame.context, FRAME_SCALE);
  frame.refresh();

  const plans = partPlans();
  const gap = 2;
  const sheetWidth = Math.max(...plans.map((plan) => plan.width)) + gap * 2;
  const sheetHeight = plans.reduce((total, plan) => total + plan.height + gap, gap);
  const parts = createCanvasTexture(textures, TEXTURE_KEYS.roomParts, sheetWidth * scale, sheetHeight * scale);
  let y = gap;
  for (const plan of plans) {
    const context = parts.context;
    context.save();
    context.scale(scale, scale);
    context.beginPath();
    context.rect(gap, y, plan.width, plan.height);
    context.clip();
    context.translate(gap, y);
    plan.draw(context, scale);
    context.restore();
    parts.add(plan.name, 0, Math.round(gap * scale), Math.round(y * scale), Math.round(plan.width * scale), Math.round(plan.height * scale));
    y += plan.height + gap;
  }
  parts.refresh();
}
