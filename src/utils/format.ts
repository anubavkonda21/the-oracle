/** Zero-pads a count to at least three digits, the way the machine prints numbers: `7` → `007`. */
export function formatCount(count: number): string {
  return String(count).padStart(3, '0');
}

/** The machine's name for a query in its log: `4` → `QUERY_004`. */
export function formatQueryId(queryNumber: number): string {
  return `QUERY_${formatCount(queryNumber)}`;
}

/** Formats a position within a fixed total as a zero-padded machine counter, e.g. `01 / 06`. */
export function formatCounter(current: number, total: number): string {
  const width = Math.max(2, String(total).length);
  const pad = (value: number): string => String(value).padStart(width, '0');
  return `${pad(current)} / ${pad(total)}`;
}
