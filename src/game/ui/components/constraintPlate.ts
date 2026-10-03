import { PROMISE_COPY } from '../../config/promiseConfig';
import { ORACLE_KINDS } from '../../systems/oracle/oracleKind';
import { createElement, restartAnimation, uniqueId } from '../dom';

export interface ConstraintPlate {
  readonly element: HTMLElement;
  /** Plays the constraint's arrival, part by part. Without it, the constraint is simply there. */
  arrive(): void;
}

/**
 * The constraint the machine is under, printed above it like the plate on an
 * instrument (styles: `.constraint` in oracle.css): that it obeys one of two
 * rules, what a machine under each rule does, and what the two are called.
 *
 * The order matters, and the arrival keeps to it — the statement, then the
 * two behaviours, and the names last — so the player meets the distinction
 * before the words for it. Afterwards the plate stays as a reference.
 *
 * It says nothing about which of the two this machine is.
 */
export function createConstraintPlate(inputSpaceSize: number): ConstraintPlate {
  const headingId = uniqueId('constraint-heading');
  const { heading, statement, rules } = PROMISE_COPY;

  const ruleList = createElement(
    'dl',
    { className: 'constraint__rules' },
    ORACLE_KINDS.map((kind) => {
      const rule = rules[kind];

      return createElement('div', { className: 'constraint__rule' }, [
        createElement('dt', { className: 'readout constraint__name' }, [
          rule.name,
          // How the inputs divide between the two outputs. The figures are a shorthand, so they are also given in words.
          createElement('span', {
            className: 'constraint__split',
            text: ` · ${rule.split(inputSpaceSize)}`,
            attributes: { 'aria-hidden': 'true' },
          }),
          createElement('span', { className: 'visually-hidden', text: ` ${rule.splitInWords(inputSpaceSize)}` }),
        ]),
        createElement('dd', { className: 'constraint__behaviour', text: rule.behaviour }),
      ]);
    }),
  );

  const element = createElement('section', { className: 'constraint', attributes: { 'aria-labelledby': headingId } }, [
    // The same signal dot and label as a status readout: this is a state the system reports.
    createElement('h2', { className: 'status constraint__heading', attributes: { id: headingId } }, [
      createElement('span', { className: 'status__dot', attributes: { 'aria-hidden': 'true' } }),
      createElement('span', { className: 'status__label', text: heading }),
    ]),
    createElement('p', { className: 'constraint__statement', text: statement }),
    ruleList,
  ]);

  return {
    element,

    arrive() {
      restartAnimation(element, 'data-arrived');
    },
  };
}
