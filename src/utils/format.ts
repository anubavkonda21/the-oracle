/** Formats a position within a fixed total as a zero-padded machine counter, e.g. `01 / 06`. */
export function formatCounter(current: number, total: number): string {
  const width = Math.max(2, String(total).length);
  const pad = (value: number): string => String(value).padStart(width, '0');
  return `${pad(current)} / ${pad(total)}`;
}
