/** Longest the game will wait for web fonts before starting with the fallback stacks instead. */
const FONT_LOAD_TIMEOUT_MS = 4000;

/**
 * Resolves once every listed family (declared via @font-face in fonts.css) is
 * ready to render, so the first screen never shows a flash of fallback type.
 * Never rejects: if a font fails or is slow, the stacks in tokens.css fall
 * back to system fonts and the game carries on.
 */
export async function loadFonts(families: readonly string[]): Promise<void> {
  const loading = Promise.all(families.map((family) => document.fonts.load(`1em "${family}"`)));
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));

  try {
    await Promise.race([loading, timeout]);
  } catch {
    // Fallback fonts are an acceptable outcome; there is nothing to recover.
  }
}
