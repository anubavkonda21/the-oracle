const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Parses `#RRGGBB` into a `0xRRGGBB` number. */
export function hexToNumber(hex: string): number {
  if (!HEX_COLOR.test(hex)) {
    throw new Error(`Expected a colour in #RRGGBB form, received "${hex}".`);
  }
  return Number.parseInt(hex.slice(1), 16);
}

/** Converts `#RRGGBB` into a CSS `rgba()` string with the given opacity (clamped to 0–1). */
export function hexToRgba(hex: string, alpha = 1): string {
  const value = hexToNumber(hex);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  const opacity = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/** WCAG 2.x relative luminance of a `#RRGGBB` colour (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const value = hexToNumber(hex);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colours (1 = identical, 21 = black on white). */
export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}
