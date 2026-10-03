import type Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, colorRgba } from '../config/designTokens';

/** Geometry of the placeholder machine, in design units, measured from the body's top-left corner. */
export const ORACLE_MACHINE = {
  width: 480,
  height: 300,
  cornerRadius: 6,
  /** Transparent margin around the body inside the texture — room for the drop shadow. */
  margin: 96,
  faceplateInset: 20,
  apertureRadius: 64,
  lensRadius: 22,
  statusLight: { x: 440, y: 40, radius: 2.5 },
} as const;

type Context = CanvasRenderingContext2D;

/** Neutral shading. The machine has one colour (machine black); everything else is light and shadow on it. */
const highlight = (alpha: number): string => `rgba(255, 255, 255, ${alpha})`;
const shade = (alpha: number): string => `rgba(0, 0, 0, ${alpha})`;

type GradientStop = readonly [offset: number, color: string];

/**
 * Stops for a gradient that runs from light, through nothing, into shadow (or
 * the reverse). Canvas gradients blend colour and opacity separately, so
 * fading white straight into black passes through a visible grey. Meeting at
 * a fully transparent stop of each colour keeps the crossover clean.
 */
function crossover(offset: number, from: (alpha: number) => string, to: (alpha: number) => string): GradientStop[] {
  return [
    [offset, from(0)],
    [offset, to(0)],
  ];
}

function verticalGradient(context: Context, top: number, bottom: number, stops: readonly GradientStop[]): CanvasGradient {
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function traceCircle(context: Context, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
}

function drawBody(context: Context, resolution: number): void {
  const { width, height, cornerRadius } = ORACLE_MACHINE;

  // Two stacked shadows: a wide ambient one and a tight contact one. Shadow
  // blur and offset ignore the canvas transform, hence the manual scaling.
  const shadows = [
    { blur: 56, offsetY: 28, alpha: 0.16 },
    { blur: 10, offsetY: 4, alpha: 0.2 },
  ];
  for (const shadow of shadows) {
    context.save();
    context.shadowColor = colorRgba('textPrimary', shadow.alpha);
    context.shadowBlur = shadow.blur * resolution;
    context.shadowOffsetY = shadow.offsetY * resolution;
    context.fillStyle = COLORS.machineBlack;
    context.beginPath();
    context.roundRect(0, 0, width, height, cornerRadius);
    context.fill();
    context.restore();
  }

  // Matte finish: barely lighter where the top catches light, darker toward the base.
  context.save();
  context.beginPath();
  context.roundRect(0, 0, width, height, cornerRadius);
  context.clip();
  context.fillStyle = verticalGradient(context, 0, height, [
    [0, highlight(0.045)],
    ...crossover(0.45, highlight, shade),
    [1, shade(0.24)],
  ]);
  context.fillRect(0, 0, width, height);
  context.restore();

  // Thin warm-grey outer edge.
  context.lineWidth = 1;
  context.strokeStyle = COLORS.textSecondary;
  context.beginPath();
  context.roundRect(0.5, 0.5, width - 1, height - 1, cornerRadius - 0.5);
  context.stroke();

  // Inner bevel: a lit top edge fading into a shadowed bottom edge.
  context.strokeStyle = verticalGradient(context, 0, height, [
    [0, highlight(0.16)],
    [0.3, highlight(0.03)],
    ...crossover(0.6, highlight, shade),
    [1, shade(0.55)],
  ]);
  context.beginPath();
  context.roundRect(1.5, 1.5, width - 3, height - 3, cornerRadius - 1.5);
  context.stroke();
}

function drawFaceplate(context: Context): void {
  const { width, height, faceplateInset: inset } = ORACLE_MACHINE;

  // A machined groove: a dark line with a faint lit line just beneath it.
  const groove = [
    { offset: 0, color: shade(0.6) },
    { offset: 1, color: highlight(0.05) },
  ];
  context.lineWidth = 1;
  for (const line of groove) {
    context.strokeStyle = line.color;
    context.beginPath();
    context.roundRect(inset + 0.5, inset + 0.5 + line.offset, width - inset * 2 - 1, height - inset * 2 - 1, 3);
    context.stroke();
  }
}

function drawAperture(context: Context): void {
  const { width, height, apertureRadius: radius, lensRadius } = ORACLE_MACHINE;
  const centerX = width / 2;
  const centerY = height / 2;

  // Bezel ring around the opening.
  context.lineWidth = 1;
  context.strokeStyle = shade(0.6);
  traceCircle(context, centerX, centerY, radius + 14);
  context.stroke();
  context.strokeStyle = highlight(0.06);
  traceCircle(context, centerX, centerY, radius + 15);
  context.stroke();

  // The recess: darkest under the upper lip, with a trace of light on the lower wall.
  traceCircle(context, centerX, centerY, radius);
  context.fillStyle = shade(0.72);
  context.fill();
  context.fillStyle = verticalGradient(context, centerY - radius, centerY + radius, [
    [0, shade(0.7)],
    ...crossover(0.55, shade, highlight),
    [1, highlight(0.05)],
  ]);
  context.fill();

  // Rim: shadowed above, catching light below.
  context.lineWidth = 1.5;
  context.strokeStyle = verticalGradient(context, centerY - radius, centerY + radius, [
    [0, shade(0.9)],
    ...crossover(0.45, shade, highlight),
    [1, highlight(0.24)],
  ]);
  traceCircle(context, centerX, centerY, radius);
  context.stroke();

  // The lens at the bottom of the recess, with a single faint reflection.
  traceCircle(context, centerX, centerY, lensRadius);
  context.fillStyle = shade(0.85);
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = highlight(0.09);
  context.stroke();

  context.lineWidth = 1.5;
  context.lineCap = 'round';
  context.strokeStyle = highlight(0.12);
  context.beginPath();
  context.arc(centerX, centerY, lensRadius - 7, Math.PI * 1.12, Math.PI * 1.4);
  context.stroke();
}

function drawStatusLightSocket(context: Context): void {
  const { statusLight } = ORACLE_MACHINE;

  // Only the unlit socket is baked in; the light itself is a live game object (see OracleMachine).
  traceCircle(context, statusLight.x, statusLight.y, statusLight.radius + 3);
  context.fillStyle = shade(0.7);
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = highlight(0.08);
  context.stroke();
}

/**
 * Draws the placeholder machine into a texture at the game's render
 * resolution. Procedural rather than a bitmap asset: it is resolution
 * independent and adds nothing to the download.
 */
export function createOracleMachineTexture(textures: Phaser.Textures.TextureManager, resolution: number): void {
  if (textures.exists(TEXTURE_KEYS.oracleMachine)) {
    return;
  }

  const { width, height, margin } = ORACLE_MACHINE;
  const texture = textures.createCanvas(
    TEXTURE_KEYS.oracleMachine,
    Math.ceil((width + margin * 2) * resolution),
    Math.ceil((height + margin * 2) * resolution),
  );
  if (!texture) {
    throw new Error('Could not create the canvas texture for the Oracle machine.');
  }

  const context = texture.context;
  context.scale(resolution, resolution);
  context.translate(margin, margin);

  drawBody(context, resolution);
  drawFaceplate(context);
  drawAperture(context);
  drawStatusLightSocket(context);

  texture.refresh();
}
