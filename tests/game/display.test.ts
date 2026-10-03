import { describe, expect, it } from 'vitest';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  MIN_VIEWPORT_WIDTH,
  fitScale,
  resolveRenderResolution,
} from '../../src/game/config/display';
import { COMPACT_VIEWPORT_QUERY } from '../../src/game/systems/desktopGate';

describe('design frame', () => {
  it('is 1440 × 900', () => {
    expect([DESIGN_WIDTH, DESIGN_HEIGHT]).toEqual([1440, 900]);
  });

  it('gates the game below a 900px-wide viewport', () => {
    expect(MIN_VIEWPORT_WIDTH).toBe(900);
    expect(COMPACT_VIEWPORT_QUERY).toBe('(max-width: 899px)');
  });
});

describe('fitScale', () => {
  it('is exactly 1 at the design resolution', () => {
    expect(fitScale(1440, 900)).toBe(1);
  });

  it.each([
    { width: 1920, height: 1080, expected: 1.2 },
    { width: 1366, height: 768, expected: 768 / 900 },
    { width: 1280, height: 720, expected: 0.8 },
  ])('fits $width × $height by its limiting dimension', ({ width, height, expected }) => {
    expect(fitScale(width, height)).toBeCloseTo(expected, 10);
  });

  it('never crops: the scaled frame always fits inside the viewport', () => {
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1280, 720],
      [900, 1200],
      [2560, 1080],
    ] as const) {
      const scale = fitScale(width, height);
      expect(DESIGN_WIDTH * scale).toBeLessThanOrEqual(width + 1e-9);
      expect(DESIGN_HEIGHT * scale).toBeLessThanOrEqual(height + 1e-9);
    }
  });
});

describe('resolveRenderResolution', () => {
  it('renders 1:1 on a standard-density screen no larger than the design frame', () => {
    expect(resolveRenderResolution({ devicePixelRatio: 1, screenWidth: 1440, screenHeight: 900 })).toBe(1);
    expect(resolveRenderResolution({ devicePixelRatio: 1, screenWidth: 1280, screenHeight: 720 })).toBe(1);
  });

  it('doubles on a high-density screen', () => {
    expect(resolveRenderResolution({ devicePixelRatio: 2, screenWidth: 1440, screenHeight: 900 })).toBe(2);
  });

  it('covers the largest size the stage can reach on the screen', () => {
    // A 1920 × 1080 screen can show the stage at 1.2×, so 1.2 is rounded up to the next step.
    expect(resolveRenderResolution({ devicePixelRatio: 1, screenWidth: 1920, screenHeight: 1080 })).toBe(1.25);
  });

  it('is capped so very large or dense screens do not allocate an enormous canvas', () => {
    expect(resolveRenderResolution({ devicePixelRatio: 3, screenWidth: 3840, screenHeight: 2160 })).toBe(3);
  });

  it('falls back to 1 when the environment reports nonsense', () => {
    expect(resolveRenderResolution({ devicePixelRatio: 0, screenWidth: 0, screenHeight: 0 })).toBe(1);
    expect(resolveRenderResolution({ devicePixelRatio: Number.NaN, screenWidth: Number.NaN, screenHeight: 900 })).toBe(1);
  });

  it('always yields a canvas with whole-pixel dimensions', () => {
    for (const devicePixelRatio of [1, 1.1, 1.25, 1.5, 1.75, 2, 2.625, 3]) {
      for (const [screenWidth, screenHeight] of [
        [1280, 720],
        [1366, 768],
        [1512, 982],
        [1920, 1080],
        [2560, 1440],
      ] as const) {
        const resolution = resolveRenderResolution({ devicePixelRatio, screenWidth, screenHeight });
        expect(Number.isInteger(DESIGN_WIDTH * resolution)).toBe(true);
        expect(Number.isInteger(DESIGN_HEIGHT * resolution)).toBe(true);
      }
    }
  });
});
