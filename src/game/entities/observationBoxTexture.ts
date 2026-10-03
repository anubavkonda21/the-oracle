import type Phaser from 'phaser';
import type { Bit } from '../../quantum';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, colorRgba } from '../config/designTokens';

/** Geometry of the box, in design units, measured from the top-left corner of its body. */
export const OBSERVATION_BOX = {
  width: 560,
  height: 340,
  cornerRadius: 4,
  /** Transparent margin around the body inside the texture — room for the shadow. */
  margin: 96,
  /** The lid is the strip above this line. */
  lidHeight: 56,
  /** The shuttered opening in the front face. */
  window: { x: 130, y: 92, width: 300, height: 170 },
  /** Where the floor of the interior sits, measured from the top of the window. */
  floorY: 132,
  statusLight: { x: 524, y: 28, radius: 2.5 },
} as const;

type Context = CanvasRenderingContext2D;
type GradientStop = readonly [offset: number, color: string];

/** Neutral shading: the box has one colour, and everything else is light and shadow on it. */
const highlight = (alpha: number): string => `rgba(255, 255, 255, ${alpha})`;
const shade = (alpha: number): string => `rgba(0, 0, 0, ${alpha})`;
/** The dim light inside the box, in the room's own off-white. */
const glow = (alpha: number): string => colorRgba('darkTextPrimary', alpha);
/** Whatever is inside is only ever seen as a shadow. */
const SILHOUETTE = shade(0.93);

function verticalGradient(context: Context, top: number, bottom: number, stops: readonly GradientStop[]): CanvasGradient {
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

/**
 * The matte finish of the box's front, as a function of height on the body.
 * The body and the shutter are separate textures; painting both with this
 * keeps the closed shutter indistinguishable in tone from the face around it.
 */
function paintFace(context: Context, x: number, y: number, width: number, height: number): void {
  context.fillStyle = COLORS.darkBackground;
  context.fillRect(x, y, width, height);
  context.fillStyle = highlight(0.06); // lifts the box just clear of the room behind it
  context.fillRect(x, y, width, height);
  context.fillStyle = verticalGradient(context, 0, OBSERVATION_BOX.height, [
    [0, highlight(0.035)],
    [0.5, highlight(0)],
    [0.5, shade(0)],
    [1, shade(0.24)],
  ]);
  context.fillRect(x, y, width, height);
}

/** A machined groove: a dark line with a faint lit line just beneath it. */
function strokeGroove(context: Context, trace: (offsetY: number) => void): void {
  context.lineWidth = 1;
  context.strokeStyle = shade(0.6);
  trace(0);
  context.stroke();
  context.strokeStyle = highlight(0.05);
  trace(1);
  context.stroke();
}

function drawBody(context: Context, resolution: number): void {
  const { width, height, cornerRadius, lidHeight, window, statusLight } = OBSERVATION_BOX;

  // A soft, dark pool beneath the box. Shadow blur and offset ignore the canvas transform, hence the scaling.
  context.save();
  context.shadowColor = shade(0.6);
  context.shadowBlur = 70 * resolution;
  context.shadowOffsetY = 30 * resolution;
  context.fillStyle = COLORS.darkBackground;
  context.beginPath();
  context.roundRect(0, 0, width, height, cornerRadius);
  context.fill();
  context.restore();

  context.save();
  context.beginPath();
  context.roundRect(0, 0, width, height, cornerRadius);
  context.clip();
  paintFace(context, 0, 0, width, height);
  context.restore();

  // Outer edge, then a bevel: lit along the top, shadowed along the bottom.
  context.lineWidth = 1;
  context.strokeStyle = COLORS.darkBorder;
  context.beginPath();
  context.roundRect(0.5, 0.5, width - 1, height - 1, cornerRadius - 0.5);
  context.stroke();

  context.strokeStyle = verticalGradient(context, 0, height, [
    [0, highlight(0.14)],
    [0.25, highlight(0.02)],
    [0.6, highlight(0)],
    [0.6, shade(0)],
    [1, shade(0.5)],
  ]);
  context.beginPath();
  context.roundRect(1.5, 1.5, width - 3, height - 3, cornerRadius - 1.5);
  context.stroke();

  // The seam where the lid meets the body.
  strokeGroove(context, (offsetY) => {
    context.beginPath();
    context.moveTo(2, lidHeight + 0.5 + offsetY);
    context.lineTo(width - 2, lidHeight + 0.5 + offsetY);
  });

  // Two latches holding the lid shut.
  for (const latchX of [118, width - 118 - 24]) {
    context.fillStyle = shade(0.45);
    context.beginPath();
    context.roundRect(latchX, lidHeight - 7, 24, 14, 2);
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = highlight(0.1);
    context.stroke();
  }

  // The frame around the opening.
  strokeGroove(context, (offsetY) => {
    context.beginPath();
    context.roundRect(window.x - 6.5, window.y - 6.5 + offsetY, window.width + 13, window.height + 13, 3);
  });

  // The socket of the status light; the light itself is a live game object.
  context.beginPath();
  context.arc(statusLight.x, statusLight.y, statusLight.radius + 3, 0, Math.PI * 2);
  context.fillStyle = shade(0.6);
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = highlight(0.08);
  context.stroke();
}

/** The inside of the box: dimly lit from above, with a floor. */
function drawInterior(context: Context): void {
  const { window, floorY } = OBSERVATION_BOX;
  const { width, height } = window;

  context.fillStyle = COLORS.darkBackground;
  context.fillRect(0, 0, width, height);
  context.fillStyle = glow(0.11);
  context.fillRect(0, 0, width, height);

  const pool = context.createRadialGradient(width / 2, 30, 8, width / 2, 30, 210);
  pool.addColorStop(0, glow(0.13));
  pool.addColorStop(1, glow(0));
  context.fillStyle = pool;
  context.fillRect(0, 0, width, height);

  context.fillStyle = shade(0.22);
  context.fillRect(0, floorY, width, height - floorY);
  context.fillStyle = highlight(0.07);
  context.fillRect(0, floorY, width, 1);

  // The opening is recessed: its top and sides fall into shadow.
  context.fillStyle = verticalGradient(context, 0, 30, [
    [0, shade(0.6)],
    [1, shade(0)],
  ]);
  context.fillRect(0, 0, width, 30);
  for (const [from, to] of [
    [0, 18],
    [width, width - 18],
  ] as const) {
    const side = context.createLinearGradient(from, 0, to, 0);
    side.addColorStop(0, shade(0.4));
    side.addColorStop(1, shade(0));
    context.fillStyle = side;
    context.fillRect(Math.min(from, to), 0, 18, height);
  }
}

/** The closed shutter: the same finish as the face, ruled with slats. */
function drawShutter(context: Context): void {
  const { window } = OBSERVATION_BOX;

  context.save();
  context.translate(-window.x, -window.y); // so the face shading lines up with the body around it
  paintFace(context, window.x, window.y, window.width, window.height);
  context.restore();

  for (let slatY = 17; slatY < window.height; slatY += 17) {
    context.fillStyle = shade(0.42);
    context.fillRect(0, slatY, window.width, 1);
    context.fillStyle = highlight(0.035);
    context.fillRect(0, slatY + 1, window.width, 1);
  }
}

/** Outcome 1 — AWAKE: a cat sitting upright, facing out, with the faintest catch of light in its eyes. */
function drawAwake(context: Context): void {
  const { window, floorY } = OBSERVATION_BOX;
  const centerX = window.width / 2;
  context.fillStyle = SILHOUETTE;

  // Haunches and chest.
  context.beginPath();
  context.ellipse(centerX, floorY - 13, 33, 15, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(centerX, floorY - 32, 24, 30, 0, 0, Math.PI * 2);
  context.fill();

  // Head and ears.
  context.beginPath();
  context.arc(centerX, floorY - 70, 17, 0, Math.PI * 2);
  context.fill();
  for (const direction of [-1, 1]) {
    context.beginPath();
    context.moveTo(centerX + direction * 15, floorY - 76);
    context.lineTo(centerX + direction * 12.5, floorY - 96);
    context.lineTo(centerX + direction * 2.5, floorY - 84);
    context.closePath();
    context.fill();
  }

  // Tail, wrapped round along the floor.
  context.strokeStyle = SILHOUETTE;
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX + 26, floorY - 6);
  context.quadraticCurveTo(centerX + 62, floorY - 2, centerX + 54, floorY - 24);
  context.stroke();

  context.fillStyle = glow(0.5);
  for (const direction of [-1, 1]) {
    context.beginPath();
    context.arc(centerX + direction * 6.5, floorY - 71, 1.5, 0, Math.PI * 2);
    context.fill();
  }
}

/** Outcome 0 — STILL: the same cat lying on its side along the floor. Nothing catches the light. */
function drawStill(context: Context): void {
  const { window, floorY } = OBSERVATION_BOX;
  const centerX = window.width / 2;
  context.fillStyle = SILHOUETTE;

  // Body, low along the floor.
  context.beginPath();
  context.ellipse(centerX + 8, floorY - 13, 54, 15, 0, 0, Math.PI * 2);
  context.fill();

  // Head, resting at the left end, and ears.
  context.beginPath();
  context.arc(centerX - 48, floorY - 13, 14, 0, Math.PI * 2);
  context.fill();
  for (const earX of [-58, -45]) {
    context.beginPath();
    context.moveTo(centerX + earX - 5, floorY - 22);
    context.lineTo(centerX + earX - 1, floorY - 36);
    context.lineTo(centerX + earX + 7, floorY - 24);
    context.closePath();
    context.fill();
  }

  // Tail, trailing out along the floor.
  context.strokeStyle = SILHOUETTE;
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(centerX + 56, floorY - 9);
  context.quadraticCurveTo(centerX + 84, floorY - 4, centerX + 96, floorY - 6);
  context.stroke();
}

/** Creates a canvas texture and draws into it in design units, at the game's render resolution. */
function createTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
  resolution: number,
  draw: (context: Context) => void,
): void {
  if (textures.exists(key)) {
    return;
  }
  const texture = textures.createCanvas(key, Math.ceil(width * resolution), Math.ceil(height * resolution));
  if (!texture) {
    throw new Error(`Could not create the canvas texture "${key}".`);
  }
  texture.context.scale(resolution, resolution);
  draw(texture.context);
  texture.refresh();
}

/** The texture that pictures each measured outcome. */
export function outcomeTextureKey(outcome: Bit): string {
  return outcome === 1 ? TEXTURE_KEYS.boxOutcomeAwake : TEXTURE_KEYS.boxOutcomeStill;
}

/**
 * Draws every texture THE BOX needs: the body, the lit interior, the shutter
 * that covers it, and one silhouette per outcome. Procedural, like the
 * machine: resolution independent, and nothing to download.
 */
export function createObservationBoxTextures(textures: Phaser.Textures.TextureManager, resolution: number): void {
  const { width, height, margin, window } = OBSERVATION_BOX;

  createTexture(textures, TEXTURE_KEYS.box, width + margin * 2, height + margin * 2, resolution, (context) => {
    context.translate(margin, margin);
    drawBody(context, resolution);
  });
  createTexture(textures, TEXTURE_KEYS.boxInterior, window.width, window.height, resolution, drawInterior);
  createTexture(textures, TEXTURE_KEYS.boxShutter, window.width, window.height, resolution, drawShutter);
  createTexture(textures, TEXTURE_KEYS.boxOutcomeStill, window.width, window.height, resolution, drawStill);
  createTexture(textures, TEXTURE_KEYS.boxOutcomeAwake, window.width, window.height, resolution, drawAwake);
}
