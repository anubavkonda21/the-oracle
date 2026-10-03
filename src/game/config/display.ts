/**
 * The design frame. Every layout value in the game is authored against this
 * 1440 × 900 reference and scaled uniformly to fit the window.
 */
export const DESIGN_WIDTH = 1440;
export const DESIGN_HEIGHT = 900;

/** Below this viewport width the game is replaced by the desktop-only notice. */
export const MIN_VIEWPORT_WIDTH = 900;

const MIN_RENDER_RESOLUTION = 1;
const MAX_RENDER_RESOLUTION = 3;
/** Resolutions are rounded up to this step so the canvas always has whole-pixel dimensions. */
const RENDER_RESOLUTION_STEP = 0.25;

export interface DisplayEnvironment {
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
}

/** Uniform scale at which the design frame fits inside an area — letterboxed, never cropped. */
export function fitScale(width: number, height: number): number {
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

/**
 * Canvas pixels to render per design unit.
 *
 * Phaser has no built-in device-pixel-ratio handling, so the canvas is created
 * larger than the design frame and each scene's camera zooms by this factor.
 * The value is sized for the largest the stage can get on this screen, which
 * keeps the canvas sharp from a small window up to fullscreen without ever
 * having to re-create textures.
 */
export function resolveRenderResolution(environment: DisplayEnvironment): number {
  const { devicePixelRatio, screenWidth, screenHeight } = environment;
  const pixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const largestFit = fitScale(screenWidth, screenHeight);
  const upscale = Number.isFinite(largestFit) ? Math.max(1, largestFit) : 1;

  const ideal = Math.min(MAX_RENDER_RESOLUTION, Math.max(MIN_RENDER_RESOLUTION, pixelRatio * upscale));
  return Math.ceil(ideal / RENDER_RESOLUTION_STEP) * RENDER_RESOLUTION_STEP;
}
