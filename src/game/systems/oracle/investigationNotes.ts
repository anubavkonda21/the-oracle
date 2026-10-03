import { INVESTIGATION_NOTES } from '../../config/investigationConfig';
import type { InvestigationProgress } from './Investigation';

/** The laboratory's remark on the investigation as it stands. */
export interface InvestigationNote {
  /** Which remark this is: its position in `INVESTIGATION_NOTES`. It never goes down as the record grows. */
  readonly stage: number;
  readonly text: string;
}

/**
 * The remark that applies to an investigation: the last one in the list that
 * the number of queries has reached. `null` before the first query — the
 * laboratory says nothing until the player has acted.
 */
export function investigationNote(progress: InvestigationProgress): InvestigationNote | null {
  let current: InvestigationNote | null = null;

  for (const [stage, rule] of INVESTIGATION_NOTES.entries()) {
    if (progress.queryCount >= rule.fromQuery(progress.inputSpaceSize)) {
      current = { stage, text: rule.text(progress) };
    }
  }
  return current;
}
