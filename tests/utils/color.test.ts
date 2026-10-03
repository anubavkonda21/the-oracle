import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToNumber, hexToRgba, relativeLuminance } from '../../src/utils/color';

describe('hexToNumber', () => {
  it('parses #RRGGBB in either case', () => {
    expect(hexToNumber('#F1EFE9')).toBe(0xf1efe9);
    expect(hexToNumber('#f1efe9')).toBe(0xf1efe9);
    expect(hexToNumber('#000000')).toBe(0);
  });

  it.each(['F1EFE9', '#FFF', '#F1EFE9FF', '#GGGGGG', ''])('rejects "%s"', (value) => {
    expect(() => hexToNumber(value)).toThrow(/#RRGGBB/);
  });
});

describe('hexToRgba', () => {
  it('splits the colour into channels', () => {
    expect(hexToRgba('#5146A8', 0.25)).toBe('rgba(81, 70, 168, 0.25)');
  });

  it('defaults to fully opaque', () => {
    expect(hexToRgba('#111111')).toBe('rgba(17, 17, 17, 1)');
  });

  it('clamps opacity to the 0–1 range', () => {
    expect(hexToRgba('#111111', 4)).toBe('rgba(17, 17, 17, 1)');
    expect(hexToRgba('#111111', -1)).toBe('rgba(17, 17, 17, 0)');
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 between black and white, in either order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 10);
  });

  it('is 1:1 for identical colours', () => {
    expect(contrastRatio('#6F6D67', '#6F6D67')).toBe(1);
  });

  it('matches a known reference value', () => {
    // #767676 on white is the well-known "just passes AA" grey: 4.54:1.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});
