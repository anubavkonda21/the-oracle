import { formatCount, formatQueryId } from '../../../utils/format';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import { createElement } from '../dom';
import { createPanel } from './panel';

export interface ExperimentLog {
  readonly element: HTMLElement;
  /** Appends a query to the record and brings it into view. */
  add(query: OracleQuery): void;
}

/**
 * The running record of everything the player has asked the machine and what
 * it answered (styles: `.log` in oracle.css). It only ever grows, oldest
 * entry at the top, like a printed log.
 */
export function createExperimentLog(): ExperimentLog {
  const count = createElement('span', { className: 'log__count-value', text: formatCount(0) });
  const emptyNotice = createElement('p', { className: 'log__empty', text: 'NO QUERIES RECORDED' });
  const rows = createElement('tbody');

  const table = createElement('table', { className: 'log__table' }, [
    createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { text: 'QUERY', attributes: { scope: 'col' } }),
        createElement('th', { text: 'INPUT', attributes: { scope: 'col' } }),
        createElement('th', { text: 'OUTPUT', attributes: { scope: 'col' } }),
      ]),
    ]),
    rows,
  ]);
  table.hidden = true;

  // role="log" makes each new entry announced by screen readers; tabindex lets the keyboard scroll a long record.
  const scrollArea = createElement(
    'div',
    { className: 'log__scroll', attributes: { role: 'log', 'aria-label': 'Experiment log entries', tabindex: '0' } },
    [table],
  );

  const element = createPanel({
    heading: 'EXPERIMENT LOG',
    content: [
      createElement('p', { className: 'log__count' }, [createElement('span', { text: 'QUERIES' }), count]),
      emptyNotice,
      scrollArea,
    ],
  });
  element.classList.add('log');

  return {
    element,

    add(query) {
      emptyNotice.remove();
      table.hidden = false;

      rows.querySelector('[data-latest]')?.removeAttribute('data-latest');
      const row = createElement('tr', { attributes: { 'data-latest': '' } }, [
        createElement('td', { text: formatQueryId(query.number) }),
        createElement('td', { text: query.input }),
        createElement('td', { text: String(query.output) }),
      ]);
      rows.append(row);

      count.textContent = formatCount(query.number);
      scrollArea.scrollTop = scrollArea.scrollHeight;
    },
  };
}
