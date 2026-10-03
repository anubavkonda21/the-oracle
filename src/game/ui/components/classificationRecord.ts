import { PROMISE_COPY } from '../../config/promiseConfig';
import { observedOutputs, type ConclusionStanding, type Evidence } from '../../systems/oracle/evidence';
import { ORACLE_KINDS, type OracleKind } from '../../systems/oracle/oracleKind';
import { createElement } from '../dom';
import { createControlButton, setPressed } from './controlButton';

/** What the classification record draws: the evidence, the conclusion on record, and how that conclusion stands. */
export interface ClassificationState {
  readonly evidence: Evidence;
  readonly conclusion: OracleKind | null;
  /** `null` when there is no conclusion to judge. */
  readonly standing: ConclusionStanding | null;
}

export interface ClassificationRecordOptions {
  /** The player chose one of the two kinds as their conclusion. Choosing the one already recorded withdraws it. */
  onConclude: (kind: OracleKind) => void;
}

export interface ClassificationRecord {
  readonly element: HTMLElement;
  render(state: ClassificationState): void;
}

/**
 * The part of the record that bears on the classification (styles:
 * `.classification` in oracle.css). It sits in the experiment log, above the
 * entries it is drawn from.
 *
 *   OUTPUTS OBSERVED — the evidence, stated and left at that. It draws no
 *                      conclusion: that is for the player.
 *   CONCLUSION       — the conclusion the player puts on record, by choosing
 *                      one of the two kinds; and how it stands against the
 *                      evidence — established, not established, or
 *                      contradicted — with the part of the evidence that
 *                      decides it.
 *
 * The standing is never "right" or "wrong". The laboratory does not know the
 * answer; it knows what the record shows.
 *
 * The chosen kind is shown by a filled control (and `aria-pressed`), and its
 * standing in words, so nothing here is told by colour.
 */
export function createClassificationRecord({ onConclude }: ClassificationRecordOptions): ClassificationRecord {
  const { evidence: evidenceCopy, conclusion: conclusionCopy, rules } = PROMISE_COPY;

  const observed = createElement('span');
  const standing = createElement('span');
  const reason = createElement('p', { className: 'classification__reason' });

  const choices = ORACLE_KINDS.map((kind) => {
    const control = createControlButton({ label: rules[kind].name, onActivate: () => onConclude(kind) });
    control.classList.add('control--compact');
    setPressed(control, false);
    return { kind, control };
  });

  const element = createElement('div', { className: 'classification' }, [
    createElement('p', { className: 'classification__row' }, [createElement('span', { text: evidenceCopy.label }), observed]),
    createElement(
      'div',
      { className: 'classification__conclusion', attributes: { role: 'group', 'aria-label': conclusionCopy.choose } },
      [
        createElement('p', { className: 'classification__row' }, [createElement('span', { text: conclusionCopy.label }), standing]),
        createElement(
          'div',
          { className: 'classification__choices' },
          choices.map(({ control }) => control),
        ),
        reason,
      ],
    ),
  ]);

  return {
    element,

    render(state) {
      observed.textContent = evidenceCopy.observed[observedOutputs(state.evidence)];
      standing.textContent = conclusionCopy.standing[state.standing ?? 'none'];
      reason.textContent = state.conclusion ? conclusionCopy.reason(state.conclusion, state.evidence) : '';

      for (const { kind, control } of choices) {
        setPressed(control, kind === state.conclusion);
      }
    },
  };
}
