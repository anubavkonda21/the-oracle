import type Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, FONT_STACKS, colorRgba } from '../config/designTokens';
import { createSeededRandom } from '../../utils/random';
import {
  MACHINE,
  PORT_COUNT,
  RESONATOR_COUNT,
  TICK_COUNT,
  aroundEye,
  portPosition,
  resonatorAngle,
  resonatorPosition,
  tickAngle,
} from './oracleMachineLayout';

/**
 * The machine, drawn. Everything here is procedural — painted once into
 * textures at the game's render resolution, when the game starts. Nothing is
 * downloaded, and nothing here runs per frame.
 *
 * Three textures:
 *
 *   the body   — the machine as it stands unlit: chassis, wings, the eye's
 *                mechanics, the base it stands on
 *   its light  — the same hardware as the eye's own light catches it. The
 *                live machine lays this over the body, tinted and faded to
 *                match what the eye is doing, so the metal round the eye
 *                answers to it
 *   the parts  — every light and moving piece (ticks, rings, glows, digits),
 *                each a frame of one sheet. All are drawn in white and
 *                coloured by the live machine
 */

type Context = CanvasRenderingContext2D;

/** Cool white light and deep shade. The machine has one colour; everything else is one of these over it. */
const light = (alpha: number): string => colorRgba('instrument', alpha);
const shade = (alpha: number): string => colorRgba('void', alpha);
/** Pure white, for the textures the live machine colours itself. */
const white = (alpha: number): string => `rgba(255, 255, 255, ${alpha})`;

const FULL_TURN = Math.PI * 2;

/** Frames of the parts sheet. */
export const MACHINE_PARTS = {
  glow: 'glow',
  hot: 'hot',
  fill: 'fill',
  ring: 'ring',
  irisOuter: 'iris-outer',
  irisMiddle: 'iris-middle',
  irisInner: 'iris-inner',
  pulse: 'pulse',
  tick: 'tick',
  tickShort: 'tick-short',
  pointer: 'pointer',
  sweep: 'sweep',
  port: 'port',
  node: 'node',
  nodeRing: 'node-ring',
  cap: 'cap',
  status: 'status',
  glass: 'glass',
  digit0: 'digit-0',
  digit1: 'digit-1',
  pool: 'pool',
} as const;

/** Sizes the live machine needs to place the parts, in design units. */
export const PART_GEOMETRY = {
  /** Radius of the glow frames at a scale of 1. */
  glowRadius: 64,
  hotRadius: 28,
  ringRadius: 30,
  /** The sweep is drawn as an arc at the top of the dial; this is how far below the frame's centre the eye is. */
  sweepOffset: (MACHINE.dial.tickInner + MACHINE.dial.tickOuter) / 2,
  poolWidth: 420,
  poolHeight: 64,
} as const;

/* ---------- Small drawing tools ---------- */

function circle(context: Context, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, FULL_TURN);
}

function annulus(context: Context, x: number, y: number, inner: number, outer: number): void {
  context.beginPath();
  context.arc(x, y, outer, 0, FULL_TURN);
  context.arc(x, y, inner, 0, FULL_TURN, true);
}

/** A rectangle with its corners cut straight across. */
function plate(context: Context, x: number, y: number, width: number, height: number, cut: number): void {
  context.beginPath();
  context.moveTo(x + cut, y);
  context.lineTo(x + width - cut, y);
  context.lineTo(x + width, y + cut);
  context.lineTo(x + width, y + height - cut);
  context.lineTo(x + width - cut, y + height);
  context.lineTo(x + cut, y + height);
  context.lineTo(x, y + height - cut);
  context.lineTo(x, y + cut);
  context.closePath();
}

type Stop = readonly [offset: number, color: string];

function linear(context: Context, x0: number, y0: number, x1: number, y1: number, stops: readonly Stop[]): CanvasGradient {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function radial(context: Context, x: number, y: number, inner: number, outer: number, stops: readonly Stop[]): CanvasGradient {
  const gradient = context.createRadialGradient(x, y, inner, x, y, outer);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

/**
 * The sheen of turned metal: bright where the surface faces the light, dark
 * a quarter-turn round, and bright again opposite. `strength` is the opacity
 * at the brightest point. Returns `null` where the browser has no conic
 * gradients; the metal is then simply left without its sheen.
 */
function turnedSheen(context: Context, x: number, y: number, strength: number): CanvasGradient | null {
  if (typeof context.createConicGradient !== 'function') {
    return null;
  }
  // The key light is above and to the left.
  const gradient = context.createConicGradient(-Math.PI * 0.75, x, y);
  gradient.addColorStop(0, light(strength));
  gradient.addColorStop(0.12, light(strength * 0.25));
  gradient.addColorStop(0.25, shade(strength * 1.4));
  gradient.addColorStop(0.42, light(strength * 0.3));
  gradient.addColorStop(0.5, light(strength * 0.55));
  gradient.addColorStop(0.62, light(strength * 0.15));
  gradient.addColorStop(0.75, shade(strength * 1.4));
  gradient.addColorStop(0.9, light(strength * 0.3));
  gradient.addColorStop(1, light(strength));
  return gradient;
}

/**
 * Draws only the blurred shadow of a shape — a soft light, or a soft shade,
 * with no edge of its own. The shape itself is drawn far off the canvas and
 * its shadow thrown back to where the shape should have been. (Shadow blur
 * and offset are in canvas pixels and ignore the transform, hence `scale`.)
 */
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

/** A small tile of faint black and white specks, to give a painted surface the grain of a real one. */
function grainPattern(context: Context, seed: number, strength: number): CanvasPattern | null {
  const size = 96;
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
    const tone = random() < 0.5 ? 0 : 255;
    image.data[offset] = tone;
    image.data[offset + 1] = tone;
    image.data[offset + 2] = tone;
    image.data[offset + 3] = Math.round(random() * strength * 255);
  }
  tileContext.putImageData(image, 0, 0);
  return context.createPattern(tile, 'repeat');
}

/** Fills the current path's clip with grain, at one speck per canvas pixel whatever the transform. */
function grain(context: Context, pattern: CanvasPattern | null): void {
  if (!pattern) {
    return;
  }
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = pattern;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.restore();
}

/** Text with its letters spaced out, drawn one at a time so the spacing is the same in every browser. */
function spacedText(context: Context, text: string, x: number, y: number, spacing: number): void {
  let cursor = x;
  for (const letter of text) {
    context.fillText(letter, cursor, y);
    cursor += context.measureText(letter).width + spacing;
  }
}

/** A small fastener: a recess, a head, and the slot across it. */
function fastener(context: Context, x: number, y: number, radius: number, slotAngle: number): void {
  circle(context, x, y, radius + 1.2);
  context.fillStyle = shade(0.75);
  context.fill();
  circle(context, x, y, radius);
  context.fillStyle = radial(context, x - radius * 0.4, y - radius * 0.5, 0, radius * 1.5, [
    [0, light(0.22)],
    [0.6, light(0.06)],
    [1, shade(0.4)],
  ]);
  context.fill();
  context.strokeStyle = shade(0.8);
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(x - Math.cos(slotAngle) * radius * 0.7, y - Math.sin(slotAngle) * radius * 0.7);
  context.lineTo(x + Math.cos(slotAngle) * radius * 0.7, y + Math.sin(slotAngle) * radius * 0.7);
  context.stroke();
}

/* ---------- The body ---------- */

function drawBase(context: Context, scale: number): void {
  const { width, height, base } = MACHINE;
  const centre = width / 2;
  const neckBottomY = height + base.neckHeight;
  const footLeft = centre - base.footWidth / 2;

  // The light that reaches the floor under the machine is live (the pool, in the parts sheet). Baked in is only the dark it stands in.
  soft(context, scale, 16, shade(0.85), () => {
    context.beginPath();
    context.ellipse(centre, neckBottomY + base.footHeight + 3, base.footWidth * 0.56, 7, 0, 0, FULL_TURN);
    context.fill();
  });

  // Neck: narrower at the foot than at the body, lit down its left edge.
  context.beginPath();
  context.moveTo(centre - base.neckTop / 2, height - 4);
  context.lineTo(centre + base.neckTop / 2, height - 4);
  context.lineTo(centre + base.neckBottom / 2, neckBottomY);
  context.lineTo(centre - base.neckBottom / 2, neckBottomY);
  context.closePath();
  context.fillStyle = COLORS.machineBlack;
  context.fill();
  context.fillStyle = linear(context, centre - base.neckTop / 2, 0, centre + base.neckTop / 2, 0, [
    [0, light(0.07)],
    [0.18, light(0.015)],
    [0.5, shade(0.25)],
    [1, shade(0.6)],
  ]);
  context.fill();
  // The body's own shadow falls across the top of the neck.
  context.fillStyle = linear(context, 0, height - 4, 0, neckBottomY, [
    [0, shade(0.85)],
    [1, shade(0)],
  ]);
  context.fill();

  // Foot.
  plate(context, footLeft, neckBottomY - 1, base.footWidth, base.footHeight, 4);
  context.fillStyle = COLORS.machineBlack;
  context.fill();
  context.fillStyle = linear(context, 0, neckBottomY - 1, 0, neckBottomY - 1 + base.footHeight, [
    [0, light(0.09)],
    [0.22, light(0.02)],
    [0.5, shade(0.2)],
    [1, shade(0.65)],
  ]);
  context.fill();
  context.strokeStyle = linear(context, footLeft, 0, footLeft + base.footWidth, 0, [
    [0, light(0)],
    [0.3, light(0.26)],
    [0.7, light(0.2)],
    [1, light(0)],
  ]);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(footLeft + 5, neckBottomY - 0.5);
  context.lineTo(footLeft + base.footWidth - 5, neckBottomY - 0.5);
  context.stroke();
}

function drawChassis(context: Context, scale: number, surface: CanvasPattern | null): void {
  const { width, height, corner } = MACHINE;

  // The shadow the machine throws on the wall behind it: one wide and faint, one close and dark.
  for (const shadow of [
    { blur: 70, offsetY: 26, alpha: 0.75 },
    { blur: 14, offsetY: 6, alpha: 0.7 },
  ]) {
    context.save();
    context.shadowColor = shade(shadow.alpha);
    context.shadowBlur = shadow.blur * scale;
    context.shadowOffsetY = shadow.offsetY * scale;
    context.fillStyle = COLORS.machineBlack;
    plate(context, 0, 0, width, height, corner);
    context.fill();
    context.restore();
  }

  context.save();
  plate(context, 0, 0, width, height, corner);
  context.clip();

  // Anodised graphite: lit from above, falling off toward the base.
  context.fillStyle = COLORS.machineBlack;
  context.fillRect(0, 0, width, height);
  context.fillStyle = linear(context, 0, 0, 0, height, [
    [0, light(0.085)],
    [0.16, light(0.04)],
    [0.5, light(0.012)],
    [0.5, shade(0)],
    [1, shade(0.5)],
  ]);
  context.fillRect(0, 0, width, height);

  // A broad, soft band of reflected light across the upper left.
  context.fillStyle = linear(context, 0, 0, width * 0.7, height, [
    [0, light(0.05)],
    [0.28, light(0.018)],
    [0.45, light(0)],
  ]);
  context.fillRect(0, 0, width, height);

  // Brushed: fine horizontal lines, each a touch lighter or darker than the last.
  const random = createSeededRandom(31);
  const rowHeight = 1 / scale;
  for (let row = 0; row < height * scale; row += 1) {
    const tone = random() - 0.5;
    context.fillStyle = tone > 0 ? light(tone * 0.035) : shade(-tone * 0.16);
    context.fillRect(0, row * rowHeight, width, rowHeight);
  }
  grain(context, surface);
  context.restore();

  // Edges. A dark line gives the silhouette; inside it, the top edge catches the key light and the bottom edge loses it.
  plate(context, 0.5, 0.5, width - 1, height - 1, corner);
  context.lineWidth = 1;
  context.strokeStyle = shade(0.95);
  context.stroke();
  plate(context, 1.5, 1.5, width - 3, height - 3, corner - 0.5);
  context.strokeStyle = linear(context, 0, 0, 0, height, [
    [0, light(0.4)],
    [0.06, light(0.16)],
    [0.3, light(0.05)],
    [0.7, light(0.02)],
    [0.7, shade(0)],
    [1, shade(0.7)],
  ]);
  context.stroke();
  // The top edge is brightest in the middle, where the light is.
  context.strokeStyle = linear(context, 0, 0, width, 0, [
    [0, light(0)],
    [0.25, light(0.3)],
    [0.5, light(0.5)],
    [0.75, light(0.3)],
    [1, light(0)],
  ]);
  context.beginPath();
  context.moveTo(corner + 2, 1.5);
  context.lineTo(width - corner - 2, 1.5);
  context.stroke();
}

function drawWing(context: Context, left: boolean): void {
  const { wings, width } = MACHINE;
  const x = left ? wings.inset : width - wings.inset - wings.width;
  const y = wings.top;

  // A panel set into the chassis: dark, shadowed under its upper lip, with a groove round it.
  context.save();
  plate(context, x, y, wings.width, wings.height, 5);
  context.clip();
  context.fillStyle = shade(0.42);
  context.fillRect(x, y, wings.width, wings.height);
  context.fillStyle = linear(context, 0, y, 0, y + 14, [
    [0, shade(0.7)],
    [1, shade(0)],
  ]);
  context.fillRect(x, y, wings.width, 14);
  context.restore();

  plate(context, x + 0.5, y + 0.5, wings.width - 1, wings.height - 1, 5);
  context.lineWidth = 1;
  context.strokeStyle = shade(0.9);
  context.stroke();
  plate(context, x - 0.5, y - 0.5, wings.width + 1, wings.height + 1, 5.5);
  context.strokeStyle = linear(context, 0, y, 0, y + wings.height, [
    [0, shade(0.3)],
    [0.5, light(0.03)],
    [1, light(0.12)],
  ]);
  context.stroke();

  // Cooling slots. Each is a dark slit with light on the lip beneath it.
  const slotLeft = x + 12;
  const slotWidth = wings.width - 24;
  for (let slotY = y + 92; slotY <= y + wings.height - 16; slotY += 7) {
    context.beginPath();
    context.roundRect(slotLeft, slotY, slotWidth, 3, 1.5);
    context.fillStyle = shade(0.92);
    context.fill();
    context.fillStyle = light(0.085);
    context.fillRect(slotLeft + 1.5, slotY + 3.2, slotWidth - 3, 0.8);
    context.fillStyle = shade(0.5);
    context.fillRect(slotLeft + 1.5, slotY - 0.9, slotWidth - 3, 0.8);
  }

  if (left) {
    // The maker's plate: what the machine is called, and the one thing known about it — what goes in and what comes out.
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.font = `600 8.5px ${FONT_STACKS.machine}`;
    context.fillStyle = shade(0.9);
    spacedText(context, 'ORACLE', x + 12, y + 25.2, 2.6);
    context.fillStyle = light(0.5);
    spacedText(context, 'ORACLE', x + 12, y + 26, 2.6);

    context.fillStyle = light(0.14);
    context.fillRect(x + 12, y + 33, slotWidth, 0.8);

    context.font = `500 5.6px ${FONT_STACKS.machine}`;
    context.fillStyle = light(0.3);
    spacedText(context, 'IN 6 BITS', x + 12, y + 45, 1);
    spacedText(context, 'OUT 1 BIT', x + 12, y + 55, 1);

    // A blanked service socket.
    context.beginPath();
    context.roundRect(x + 12, y + 66, 30, 11, 2);
    context.fillStyle = shade(0.85);
    context.fill();
    context.strokeStyle = light(0.1);
    context.lineWidth = 0.8;
    context.stroke();
    for (let pin = 0; pin < 5; pin += 1) {
      context.fillStyle = light(0.14);
      context.fillRect(x + 16 + pin * 5, y + 70, 2, 3);
    }
  } else {
    // The status light's socket (the light itself is live), its label, and a sealed service hatch.
    const { statusLight } = MACHINE;
    circle(context, statusLight.x, statusLight.y, statusLight.radius + 3.2);
    context.fillStyle = shade(0.9);
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = linear(context, 0, statusLight.y - 6, 0, statusLight.y + 6, [
      [0, shade(0.6)],
      [1, light(0.22)],
    ]);
    context.stroke();

    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.font = `500 5.6px ${FONT_STACKS.machine}`;
    context.fillStyle = light(0.3);
    spacedText(context, 'STATUS', x + 12, statusLight.y + 0.4, 1);

    context.beginPath();
    context.roundRect(x + 12, y + 40, slotWidth, 38, 2.5);
    context.fillStyle = light(0.018);
    context.fill();
    context.strokeStyle = shade(0.85);
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.roundRect(x + 12.8, y + 40.8, slotWidth - 1.6, 36.4, 2);
    context.strokeStyle = light(0.05);
    context.lineWidth = 0.6;
    context.stroke();
    for (const [screwX, screwY] of [
      [x + 17, y + 45],
      [x + wings.width - 17, y + 45],
      [x + 17, y + 73],
      [x + wings.width - 17, y + 73],
    ] as const) {
      fastener(context, screwX, screwY, 1.5, (screwX + screwY) * 0.7);
    }
  }
}

function drawEyeMechanics(context: Context, scale: number): void {
  const { eye, flange, track, dial, chamfer, lensRadius, resonators } = MACHINE;
  const { x, y } = eye;

  // The whole assembly stands proud of the chassis and shadows it.
  soft(context, scale, 12, shade(0.9), () => {
    circle(context, x, y + 4, flange.outer + 1);
    context.fill();
  });

  // --- Flange: a collar of turned metal that carries the resonators ---
  annulus(context, x, y, flange.inner, flange.outer);
  context.fillStyle = COLORS.machineBlack;
  context.fill();
  context.fillStyle = light(0.05);
  context.fill();
  const flangeSheen = turnedSheen(context, x, y, 0.11);
  if (flangeSheen) {
    context.fillStyle = flangeSheen;
    context.fill();
  }
  // Tool marks: fine concentric lines.
  context.lineWidth = 0.5;
  for (let radius = flange.inner + 3; radius < flange.outer - 2; radius += 2.5) {
    circle(context, x, y, radius);
    context.strokeStyle = radius % 5 < 2.5 ? light(0.028) : shade(0.2);
    context.stroke();
  }
  // Its outer edge is cut at an angle: bright toward the light, dark away from it.
  context.lineWidth = 1.6;
  circle(context, x, y, flange.outer - 0.8);
  context.strokeStyle = linear(context, x - flange.outer, y - flange.outer, x + flange.outer, y + flange.outer, [
    [0.15, light(0.5)],
    [0.45, light(0.08)],
    [0.55, shade(0.3)],
    [0.85, shade(0.85)],
  ]);
  context.stroke();
  context.lineWidth = 1;
  circle(context, x, y, flange.outer + 0.3);
  context.strokeStyle = shade(0.9);
  context.stroke();

  // Bolts, between the resonators.
  for (let bolt = 0; bolt < RESONATOR_COUNT; bolt += 1) {
    const angle = resonatorAngle(bolt) + FULL_TURN / RESONATOR_COUNT / 2;
    const position = aroundEye(angle, resonators.orbit + 0.5);
    fastener(context, position.x, position.y, 2.1, angle + 0.6);
  }

  // Resonator seats: a collar, a recess, and dark glass at the bottom of it. (The caps, and all light, are live.)
  for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
    const seat = resonatorPosition(resonator);
    circle(context, seat.x, seat.y, resonators.collar);
    context.fillStyle = COLORS.machineBlack;
    context.fill();
    const collarSheen = turnedSheen(context, seat.x, seat.y, 0.2);
    context.fillStyle = collarSheen ?? light(0.08);
    context.fill();
    context.lineWidth = 0.8;
    context.strokeStyle = shade(0.9);
    context.stroke();

    circle(context, seat.x, seat.y, resonators.radius + 1.2);
    context.fillStyle = shade(0.96);
    context.fill();
    circle(context, seat.x, seat.y, resonators.radius);
    context.fillStyle = radial(context, seat.x - 2, seat.y - 3, 0, resonators.radius * 1.4, [
      [0, light(0.1)],
      [0.5, light(0.025)],
      [1, shade(0.6)],
    ]);
    context.fill();
    // One small reflection on the glass.
    context.lineWidth = 1;
    context.lineCap = 'round';
    context.strokeStyle = light(0.2);
    context.beginPath();
    context.arc(seat.x, seat.y, resonators.radius - 2.6, Math.PI * 1.12, Math.PI * 1.42);
    context.stroke();
    context.lineCap = 'butt';
  }

  // --- Track: the groove the pointer runs in ---
  annulus(context, x, y, track.inner, track.outer);
  context.fillStyle = shade(0.94);
  context.fill();
  context.lineWidth = 1;
  circle(context, x, y, track.outer - 0.5);
  context.strokeStyle = linear(context, 0, y - track.outer, 0, y + track.outer, [
    [0, shade(0.9)],
    [0.6, shade(0)],
    [0.6, light(0)],
    [1, light(0.18)],
  ]);
  context.stroke();

  // --- Dial: one tick for every input ---
  annulus(context, x, y, dial.inner, dial.outer);
  context.fillStyle = COLORS.machineBlack;
  context.fill();
  context.fillStyle = shade(0.25);
  context.fill();
  const dialSheen = turnedSheen(context, x, y, 0.06);
  if (dialSheen) {
    context.fillStyle = dialSheen;
    context.fill();
  }
  circle(context, x, y, dial.outer - 0.5);
  context.lineWidth = 1;
  context.strokeStyle = linear(context, 0, y - dial.outer, 0, y + dial.outer, [
    [0, light(0.22)],
    [0.4, light(0.03)],
    [1, shade(0.6)],
  ]);
  context.stroke();

  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    const angle = tickAngle(tick);
    const major = tick % 8 === 0;
    const from = aroundEye(angle, dial.tickInner - (major ? 2 : 0));
    const to = aroundEye(angle, dial.tickOuter + (major ? 2 : 0));
    // Engraved: a dark cut with dull paint in it.
    context.lineCap = 'round';
    context.lineWidth = 2.2;
    context.strokeStyle = shade(0.85);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.lineWidth = 0.9;
    context.strokeStyle = light(major ? 0.26 : 0.13);
    context.stroke();
  }
  context.lineCap = 'butt';

  // --- Chamfer: the bright cut edge round the lens ---
  annulus(context, x, y, chamfer.inner, chamfer.outer);
  context.fillStyle = COLORS.machineBlack;
  context.fill();
  context.fillStyle = light(0.07);
  context.fill();
  const chamferSheen = turnedSheen(context, x, y, 0.42);
  if (chamferSheen) {
    context.fillStyle = chamferSheen;
    context.fill();
  }
  context.lineWidth = 1;
  circle(context, x, y, chamfer.outer);
  context.strokeStyle = shade(0.9);
  context.stroke();

  // --- Lens: a deep recess behind smoked glass (the glass itself is live, over the light) ---
  circle(context, x, y, lensRadius);
  context.fillStyle = COLORS.void;
  context.fill();
  context.fillStyle = radial(context, x, y + 8, 0, lensRadius, [
    [0, light(0.022)],
    [0.6, light(0.008)],
    [1, shade(0.9)],
  ]);
  context.fill();
  // Guide rings on the floor of the recess, and the emitter at its centre.
  context.lineWidth = 0.6;
  for (const radius of [47, 37, 27]) {
    circle(context, x, y, radius);
    context.strokeStyle = light(0.045);
    context.stroke();
  }
  circle(context, x, y, 9);
  context.fillStyle = shade(0.9);
  context.fill();
  context.strokeStyle = light(0.1);
  context.lineWidth = 0.8;
  context.stroke();
  circle(context, x, y, 3);
  context.fillStyle = light(0.07);
  context.fill();
  // The lip of the recess shadows its upper wall.
  context.save();
  circle(context, x, y, lensRadius);
  context.clip();
  soft(context, scale, 9, shade(0.95), () => {
    annulus(context, x, y - 5, lensRadius, lensRadius + 16);
    context.fill();
  });
  context.restore();
  circle(context, x, y, lensRadius);
  context.lineWidth = 1.2;
  context.strokeStyle = shade(0.95);
  context.stroke();
}

function drawChin(context: Context): void {
  const { ports } = MACHINE;
  const first = portPosition(0);
  const last = portPosition(PORT_COUNT - 1);
  const left = first.x - ports.width / 2 - 9;
  const right = last.x + ports.width / 2 + 9;
  const top = ports.y - 8;

  // A channel cut into the chin, with a port for each bit of the input.
  context.beginPath();
  context.roundRect(left, top, right - left, 16, 4);
  context.fillStyle = shade(0.8);
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = linear(context, 0, top, 0, top + 16, [
    [0, shade(0.9)],
    [0.55, shade(0.2)],
    [1, light(0.16)],
  ]);
  context.stroke();

  for (let bit = 0; bit < PORT_COUNT; bit += 1) {
    const port = portPosition(bit);
    context.beginPath();
    context.roundRect(port.x - ports.width / 2, port.y - ports.height / 2, ports.width, ports.height, 2);
    context.fillStyle = COLORS.void;
    context.fill();
    context.fillStyle = light(0.045);
    context.fill();
    context.lineWidth = 0.6;
    context.strokeStyle = light(0.1);
    context.stroke();
  }

  context.textBaseline = 'middle';
  context.textAlign = 'right';
  context.font = `500 5.6px ${FONT_STACKS.machine}`;
  context.fillStyle = light(0.3);
  context.fillText('IN', left - 6, ports.y + 0.4);
  context.textAlign = 'left';
}

function drawBody(context: Context, scale: number): void {
  const { width, height } = MACHINE;
  const surface = grainPattern(context, 11, 0.05);

  drawBase(context, scale);
  drawChassis(context, scale, surface);
  drawWing(context, true);
  drawWing(context, false);
  for (const [x, y] of [
    [9, 22],
    [width - 9, 22],
    [9, height - 22],
    [width - 9, height - 22],
  ] as const) {
    fastener(context, x, y, 2.4, x * 0.3 + y);
  }
  drawEyeMechanics(context, scale);
  drawChin(context);
}

/* ---------- The body as the eye's light catches it ---------- */

function drawEyeLight(context: Context): void {
  const { width, height, corner, eye, flange, track, dial, chamfer, resonators, wings, ports } = MACHINE;
  const { x, y } = eye;

  context.save();
  plate(context, 0, 0, width, height, corner);
  context.clip();

  // The face of the machine, glowing faintly round the eye.
  context.fillStyle = radial(context, x, y, chamfer.outer, 230, [
    [0, white(0.16)],
    [0.35, white(0.06)],
    [1, white(0)],
  ]);
  context.fillRect(0, 0, width, height);

  // The cut edge round the lens takes the light most.
  annulus(context, x, y, chamfer.inner, chamfer.outer);
  context.fillStyle = radial(context, x, y, chamfer.inner, chamfer.outer, [
    [0, white(0.6)],
    [1, white(0.22)],
  ]);
  context.fill();

  // The dial's face, brightest at its inner edge.
  annulus(context, x, y, dial.inner, dial.outer);
  context.fillStyle = radial(context, x, y, dial.inner, dial.outer, [
    [0, white(0.3)],
    [1, white(0.08)],
  ]);
  context.fill();

  // The far wall of the pointer's groove, and the inner edge of the flange above it.
  context.lineWidth = 1.2;
  circle(context, x, y, track.outer - 0.6);
  context.strokeStyle = white(0.5);
  context.stroke();
  annulus(context, x, y, flange.inner, flange.outer);
  context.fillStyle = radial(context, x, y, flange.inner, flange.outer, [
    [0, white(0.2)],
    [1, white(0.05)],
  ]);
  context.fill();

  // Each resonator seat catches the eye's light on the far wall of its collar — the wall that faces the eye.
  context.lineCap = 'round';
  for (let resonator = 0; resonator < RESONATOR_COUNT; resonator += 1) {
    const seat = resonatorPosition(resonator);
    const outward = resonatorAngle(resonator);
    context.lineWidth = 1.5;
    context.strokeStyle = white(0.7);
    context.beginPath();
    context.arc(seat.x, seat.y, resonators.collar - 0.6, outward - 1.15, outward + 1.15);
    context.stroke();
    // And a glint on the glass, toward the eye.
    const glint = { x: seat.x - Math.cos(outward) * 4.2, y: seat.y - Math.sin(outward) * 4.2 };
    circle(context, glint.x, glint.y, 1.3);
    context.fillStyle = white(0.55);
    context.fill();
  }
  for (let bolt = 0; bolt < RESONATOR_COUNT; bolt += 1) {
    const angle = resonatorAngle(bolt) + FULL_TURN / RESONATOR_COUNT / 2;
    const position = aroundEye(angle, resonators.orbit - 1.2);
    circle(context, position.x, position.y, 1);
    context.fillStyle = white(0.6);
    context.fill();
  }
  context.lineCap = 'butt';

  // The lower wall of the channel in the chin, which faces up toward the eye.
  const first = portPosition(0);
  const last = portPosition(PORT_COUNT - 1);
  context.fillStyle = white(0.5);
  context.fillRect(first.x - ports.width / 2 - 6, ports.y + 7, last.x - first.x + ports.width + 12, 1);

  // The walls of each wing that face inward, and the lips of the slots in them.
  for (const left of [true, false]) {
    const wingX = left ? wings.inset : width - wings.inset - wings.width;
    const wallX = left ? wingX + 0.6 : wingX + wings.width - 1.6;
    context.fillStyle = white(0.42);
    context.fillRect(wallX, wings.top + 6, 1, wings.height - 12);
    for (let slotY = wings.top + 92; slotY <= wings.top + wings.height - 16; slotY += 7) {
      context.fillStyle = white(0.2);
      context.fillRect(wingX + 13.5, slotY + 3.2, wings.width - 27, 0.9);
    }
  }
  context.restore();

  // Light falls off with distance from the eye.
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = radial(context, x, y, chamfer.inner, 250, [
    [0, white(1)],
    [0.25, white(0.7)],
    [0.6, white(0.3)],
    [1, white(0.06)],
  ]);
  context.fillRect(-10, -10, width + 20, height + 20);
  context.globalCompositeOperation = 'source-over';
}

/* ---------- The parts sheet ---------- */

interface PartPlan {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Draws the part with the origin at the centre of its frame. */
  readonly draw: (context: Context, scale: number) => void;
}

/** A round glow that falls away smoothly to nothing at `radius`. */
function glow(context: Context, radius: number, stops: readonly Stop[]): void {
  context.fillStyle = radial(context, 0, 0, 0, radius, stops);
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
}

/** A stroked path with a soft glow round it. */
function glowingStroke(context: Context, scale: number, width: number, blur: number, trace: () => void): void {
  context.save();
  context.shadowColor = white(0.9);
  context.shadowBlur = blur * scale;
  context.strokeStyle = white(1);
  context.lineWidth = width;
  trace();
  context.stroke();
  context.restore();
  context.strokeStyle = white(1);
  context.lineWidth = width;
  trace();
  context.stroke();
}

function digitPart(name: string, digit: string): PartPlan {
  return {
    name,
    width: 60,
    height: 76,
    draw: (context, scale) => {
      context.font = `500 46px ${FONT_STACKS.machine}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.save();
      context.shadowColor = white(0.5);
      context.shadowBlur = 6 * scale;
      context.fillStyle = white(1);
      context.fillText(digit, 0, 2);
      context.restore();
      context.fillStyle = white(1);
      context.fillText(digit, 0, 2);
    },
  };
}

function partPlans(): PartPlan[] {
  const { dial, track, ports, resonators, lensRadius } = MACHINE;
  const tickLength = dial.tickOuter - dial.tickInner;

  return [
    {
      name: MACHINE_PARTS.glow,
      width: PART_GEOMETRY.glowRadius * 2,
      height: PART_GEOMETRY.glowRadius * 2,
      draw: (context) =>
        glow(context, PART_GEOMETRY.glowRadius, [
          [0, white(1)],
          [0.12, white(0.78)],
          [0.28, white(0.46)],
          [0.46, white(0.22)],
          [0.66, white(0.08)],
          [0.85, white(0.02)],
          [1, white(0)],
        ]),
    },
    {
      name: MACHINE_PARTS.hot,
      width: PART_GEOMETRY.hotRadius * 2,
      height: PART_GEOMETRY.hotRadius * 2,
      draw: (context) =>
        glow(context, PART_GEOMETRY.hotRadius, [
          [0, white(1)],
          [0.2, white(0.85)],
          [0.45, white(0.35)],
          [0.75, white(0.07)],
          [1, white(0)],
        ]),
    },
    {
      // Even light across the whole lens, soft only at its rim: the eye filled, with room left for a digit to be read in it.
      name: MACHINE_PARTS.fill,
      width: lensRadius * 2,
      height: lensRadius * 2,
      draw: (context) =>
        glow(context, lensRadius, [
          [0, white(1)],
          [0.55, white(0.92)],
          [0.8, white(0.6)],
          [0.94, white(0.18)],
          [1, white(0)],
        ]),
    },
    {
      name: MACHINE_PARTS.ring,
      width: 96,
      height: 96,
      draw: (context, scale) =>
        glowingStroke(context, scale, 2.2, 9, () => {
          circle(context, 0, 0, PART_GEOMETRY.ringRadius);
        }),
    },
    {
      // Three long arcs, with a mark in each gap.
      name: MACHINE_PARTS.irisOuter,
      width: 104,
      height: 104,
      draw: (context) => {
        context.strokeStyle = white(0.9);
        context.lineWidth = 1.4;
        context.lineCap = 'round';
        for (let arc = 0; arc < 3; arc += 1) {
          const start = (arc / 3) * FULL_TURN;
          context.beginPath();
          context.arc(0, 0, 47, start + 0.3, start + FULL_TURN / 3 - 0.3);
          context.stroke();
          circle(context, Math.cos(start) * 47, Math.sin(start) * 47, 1.3);
          context.fillStyle = white(0.9);
          context.fill();
        }
      },
    },
    {
      // A ring of short dashes.
      name: MACHINE_PARTS.irisMiddle,
      width: 84,
      height: 84,
      draw: (context) => {
        context.strokeStyle = white(0.85);
        context.lineWidth = 2.6;
        for (let dash = 0; dash < 24; dash += 1) {
          const start = (dash / 24) * FULL_TURN;
          context.beginPath();
          context.arc(0, 0, 37, start, start + FULL_TURN / 24 / 2.6);
          context.stroke();
        }
      },
    },
    {
      // One long arc with a marker at its open end.
      name: MACHINE_PARTS.irisInner,
      width: 64,
      height: 64,
      draw: (context) => {
        context.strokeStyle = white(0.9);
        context.lineWidth = 1;
        context.beginPath();
        context.arc(0, 0, 27, 0.5, FULL_TURN - 0.5);
        context.stroke();
        context.fillStyle = white(0.95);
        context.fillRect(25, -1.5, 4.5, 3);
      },
    },
    {
      name: MACHINE_PARTS.pulse,
      width: 128,
      height: 128,
      draw: (context, scale) =>
        glowingStroke(context, scale, 1.3, 5, () => {
          circle(context, 0, 0, lensRadius - 2);
        }),
    },
    {
      name: MACHINE_PARTS.tick,
      width: 16,
      height: tickLength + 14,
      draw: (context, scale) =>
        glowingStroke(context, scale, 2, 4, () => {
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(0, -tickLength / 2 + 1);
          context.lineTo(0, tickLength / 2 - 1);
        }),
    },
    {
      // The inner end of a tick only: an answer of 0.
      name: MACHINE_PARTS.tickShort,
      width: 16,
      height: tickLength + 14,
      draw: (context, scale) =>
        glowingStroke(context, scale, 2, 4, () => {
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(0, tickLength / 2 - 4.5);
          context.lineTo(0, tickLength / 2 - 1);
        }),
    },
    {
      // A caret riding in the track, pointing in at the dial, with a short bracket behind it.
      name: MACHINE_PARTS.pointer,
      width: 30,
      height: 18,
      draw: (context, scale) => {
        const half = (track.outer - track.inner) / 2;
        context.save();
        context.shadowColor = white(0.9);
        context.shadowBlur = 4 * scale;
        context.fillStyle = white(1);
        context.beginPath();
        context.moveTo(0, half + 0.5);
        context.lineTo(-4, -half + 0.6);
        context.lineTo(4, -half + 0.6);
        context.closePath();
        context.fill();
        context.restore();
        context.fillStyle = white(1);
        context.fill();
        context.fillRect(-9, -half - 1.4, 18, 1);
      },
    },
    {
      // An arc of light with a fading tail, drawn at the top of the dial, leading edge on the right.
      name: MACHINE_PARTS.sweep,
      width: 112,
      height: 44,
      draw: (context) => {
        const radius = PART_GEOMETRY.sweepOffset;
        const span = 1.1;
        const top = -Math.PI / 2;
        for (let slice = 0; slice < 40; slice += 1) {
          const from = top - span / 2 + (slice / 40) * span;
          const strength = (slice / 39) ** 2.2;
          context.strokeStyle = white(0.85 * strength);
          context.lineWidth = tickLength + 6;
          context.beginPath();
          context.arc(0, radius, radius, from, from + span / 40 + 0.004);
          context.stroke();
        }
      },
    },
    {
      name: MACHINE_PARTS.port,
      width: ports.width + 20,
      height: ports.height + 20,
      draw: (context, scale) => {
        context.save();
        context.shadowColor = white(0.95);
        context.shadowBlur = 6 * scale;
        context.fillStyle = white(1);
        context.beginPath();
        context.roundRect(-ports.width / 2 + 1, -ports.height / 2 + 0.8, ports.width - 2, ports.height - 1.6, 1.4);
        context.fill();
        context.fill();
        context.restore();
      },
    },
    {
      // A resonator, filled with light.
      name: MACHINE_PARTS.node,
      width: 48,
      height: 48,
      draw: (context) => {
        glow(context, 24, [
          [0, white(1)],
          [0.26, white(0.95)],
          [0.34, white(0.5)],
          [0.6, white(0.14)],
          [1, white(0)],
        ]);
      },
    },
    {
      // A resonator, as a ring of light round an empty centre.
      name: MACHINE_PARTS.nodeRing,
      width: 48,
      height: 48,
      draw: (context, scale) =>
        glowingStroke(context, scale, 1.5, 4, () => {
          circle(context, 0, 0, resonators.radius - 1.2);
        }),
    },
    {
      // The cap that seals a resonator. Not a light: it is drawn in the machine's own colours.
      name: MACHINE_PARTS.cap,
      width: 26,
      height: 26,
      draw: (context) => {
        const radius = resonators.radius + 1;
        circle(context, 0, 0, radius);
        context.fillStyle = COLORS.machineBlack;
        context.fill();
        context.fillStyle = radial(context, -2.5, -3.5, 0, radius * 1.6, [
          [0, light(0.2)],
          [0.5, light(0.06)],
          [1, shade(0.5)],
        ]);
        context.fill();
        context.lineWidth = 0.8;
        context.strokeStyle = shade(0.9);
        context.stroke();
        circle(context, 0, 0, radius - 2.8);
        context.strokeStyle = light(0.1);
        context.lineWidth = 0.6;
        context.stroke();
        circle(context, 0, 0, 1.4);
        context.fillStyle = shade(0.85);
        context.fill();
      },
    },
    {
      name: MACHINE_PARTS.status,
      width: 36,
      height: 36,
      draw: (context) => {
        glow(context, 18, [
          [0, white(1)],
          [0.14, white(1)],
          [0.2, white(0.5)],
          [0.5, white(0.12)],
          [1, white(0)],
        ]);
      },
    },
    {
      // The smoked glass over the eye: dark toward its rim, with the room's light caught across its upper left.
      name: MACHINE_PARTS.glass,
      width: lensRadius * 2 + 4,
      height: lensRadius * 2 + 4,
      draw: (context, scale) => {
        context.save();
        circle(context, 0, 0, lensRadius);
        context.clip();
        context.fillStyle = radial(context, 0, 0, lensRadius * 0.45, lensRadius, [
          [0, shade(0)],
          [0.7, shade(0.35)],
          [1, shade(0.82)],
        ]);
        context.fillRect(-lensRadius, -lensRadius, lensRadius * 2, lensRadius * 2);
        soft(context, scale, 3.5, light(0.5), () => {
          context.lineWidth = 2.4;
          context.lineCap = 'round';
          context.beginPath();
          context.arc(0, 0, lensRadius - 9, Math.PI * 1.08, Math.PI * 1.42);
          context.stroke();
        });
        soft(context, scale, 3, light(0.12), () => {
          context.lineWidth = 1.6;
          context.lineCap = 'round';
          context.beginPath();
          context.arc(0, 0, lensRadius - 6, Math.PI * 0.16, Math.PI * 0.36);
          context.stroke();
        });
        context.restore();
      },
    },
    digitPart(MACHINE_PARTS.digit0, '0'),
    digitPart(MACHINE_PARTS.digit1, '1'),
    {
      // Light on the floor under the machine.
      name: MACHINE_PARTS.pool,
      width: PART_GEOMETRY.poolWidth,
      height: PART_GEOMETRY.poolHeight,
      draw: (context) => {
        context.save();
        context.scale(1, PART_GEOMETRY.poolHeight / PART_GEOMETRY.poolWidth);
        glow(context, PART_GEOMETRY.poolWidth / 2, [
          [0, white(0.9)],
          [0.2, white(0.5)],
          [0.5, white(0.16)],
          [0.8, white(0.03)],
          [1, white(0)],
        ]);
        context.restore();
      },
    },
  ];
}

/** Lays the parts out in rows on a sheet of a fixed width. Returns each part's place, and the height the sheet needs. */
function arrangeParts(plans: readonly PartPlan[], sheetWidth: number, gap: number) {
  const places = new Map<string, { x: number; y: number }>();
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  for (const plan of plans) {
    if (x + plan.width + gap > sheetWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    places.set(plan.name, { x, y });
    x += plan.width + gap;
    rowHeight = Math.max(rowHeight, plan.height);
  }
  return { places, height: y + rowHeight + gap };
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
 * Paints the machine's three textures at the game's render resolution. The
 * web fonts must be loaded first: the machine has lettering on it, and the
 * digits it answers with are part of the parts sheet.
 */
export function createOracleMachineTextures(textures: Phaser.Textures.TextureManager, resolution: number): void {
  if (textures.exists(TEXTURE_KEYS.oracleMachine)) {
    return;
  }
  const { width, height, margin } = MACHINE;

  const body = createCanvasTexture(
    textures,
    TEXTURE_KEYS.oracleMachine,
    (width + margin.x * 2) * resolution,
    (height + margin.top + margin.bottom) * resolution,
  );
  body.context.scale(resolution, resolution);
  body.context.translate(margin.x, margin.top);
  drawBody(body.context, resolution);
  body.refresh();

  const lit = createCanvasTexture(textures, TEXTURE_KEYS.oracleMachineLight, width * resolution, height * resolution);
  lit.context.scale(resolution, resolution);
  drawEyeLight(lit.context);
  lit.refresh();

  const plans = partPlans();
  const gap = 2;
  const sheetWidth = 512;
  const { places, height: sheetHeight } = arrangeParts(plans, sheetWidth, gap);
  const parts = createCanvasTexture(textures, TEXTURE_KEYS.oracleMachineParts, sheetWidth * resolution, sheetHeight * resolution);
  for (const plan of plans) {
    const place = places.get(plan.name);
    if (!place) {
      continue;
    }
    const context = parts.context;
    context.save();
    context.scale(resolution, resolution);
    context.beginPath();
    context.rect(place.x, place.y, plan.width, plan.height);
    context.clip();
    context.translate(place.x + plan.width / 2, place.y + plan.height / 2);
    plan.draw(context, resolution);
    context.restore();
    parts.add(
      plan.name,
      0,
      Math.round(place.x * resolution),
      Math.round(place.y * resolution),
      Math.round(plan.width * resolution),
      Math.round(plan.height * resolution),
    );
  }
  parts.refresh();
}
