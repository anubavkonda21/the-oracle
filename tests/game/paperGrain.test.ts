import { describe, expect, it } from 'vitest';
import { GRAIN_DARK_ALPHA, GRAIN_LIGHT_ALPHA, createGrainPixels } from '../../src/game/effects/paperGrain';
import { createSeededRandom } from '../../src/utils/random';

const SIZE = 32;

describe('createGrainPixels', () => {
  it('returns one RGBA value per pixel of the tile', () => {
    expect(createGrainPixels(SIZE, createSeededRandom(1))).toHaveLength(SIZE * SIZE * 4);
  });

  it('is deterministic for a given seed', () => {
    const first = createGrainPixels(SIZE, createSeededRandom(7));
    const second = createGrainPixels(SIZE, createSeededRandom(7));
    expect(first).toEqual(second);
  });

  it('changes with the seed', () => {
    const first = createGrainPixels(SIZE, createSeededRandom(7));
    const second = createGrainPixels(SIZE, createSeededRandom(8));
    expect(first).not.toEqual(second);
  });

  it('contains only neutral black and white specks', () => {
    const pixels = createGrainPixels(SIZE, createSeededRandom(3));
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const [red, green, blue] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
      expect(red === 0 || red === 255).toBe(true);
      expect(green).toBe(red);
      expect(blue).toBe(red);
    }
  });

  it('stays barely visible: no speck exceeds its peak opacity', () => {
    const pixels = createGrainPixels(SIZE, createSeededRandom(3));
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const isLight = pixels[offset] === 255;
      const peak = Math.round((isLight ? GRAIN_LIGHT_ALPHA : GRAIN_DARK_ALPHA) * 255);
      expect(pixels[offset + 3]).toBeLessThanOrEqual(peak);
    }
  });

  it('mixes light and dark specks in roughly equal measure', () => {
    const pixels = createGrainPixels(SIZE, createSeededRandom(3));
    let lightCount = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] === 255) {
        lightCount += 1;
      }
    }
    const lightShare = lightCount / (SIZE * SIZE);
    expect(lightShare).toBeGreaterThan(0.4);
    expect(lightShare).toBeLessThan(0.6);
  });
});
