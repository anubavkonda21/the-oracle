import { createSeededRandom } from '../../utils/random';

/** Edge of the repeating grain tile, in CSS pixels. */
const TILE_SIZE = 192;
/** Fixed seed: the paper is the same sheet on every load. */
const GRAIN_SEED = 7;

/**
 * Peak opacity of a single speck. The sheet is dark now: light specks sit far
 * from its tone and dark specks very close to it, so the two need very
 * different opacities to end up equally faint (roughly ±1% of full brightness).
 */
export const GRAIN_DARK_ALPHA = 0.3;
export const GRAIN_LIGHT_ALPHA = 0.022;

/**
 * RGBA pixels for a square tile of paper grain: every pixel is a black or
 * white speck at a random, very low opacity. Pure, so it can be unit-tested
 * without a canvas.
 */
export function createGrainPixels(size: number, random: () => number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const isLight = random() < 0.5;
    const tone = isLight ? 255 : 0;
    const peakAlpha = isLight ? GRAIN_LIGHT_ALPHA : GRAIN_DARK_ALPHA;

    pixels[offset] = tone;
    pixels[offset + 1] = tone;
    pixels[offset + 2] = tone;
    pixels[offset + 3] = Math.round(random() * peakAlpha * 255);
  }

  return pixels;
}

/**
 * Generates the grain tile once and hands it to CSS as `--paper-grain`
 * (consumed by `.shell` in shell.css). The result is a static background
 * image: nothing here runs per frame.
 */
export function applyPaperGrain(target: HTMLElement): void {
  const pixelRatio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio)));
  const size = TILE_SIZE * pixelRatio;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    return; // The paper simply stays flat.
  }

  const image = context.createImageData(size, size);
  image.data.set(createGrainPixels(size, createSeededRandom(GRAIN_SEED)));
  context.putImageData(image, 0, 0);

  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    target.style.setProperty('--paper-grain', `url("${URL.createObjectURL(blob)}")`);
    target.style.setProperty('--paper-grain-size', `${TILE_SIZE}px`);
  }, 'image/png');
}
