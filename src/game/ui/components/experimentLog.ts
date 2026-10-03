import { formatCount, formatQueryId } from '../../../utils/format';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import { createElement, restartAnimation } from '../dom';
import { createPanel } from './panel';

export interface ExperimentLog {
  readonly element: HTMLElement;
  /** Appends an answered query to the record and brings it into view. */
  add(query: OracleQuery): void;
  /** Shows how many queries have been used. */
  renderCount(queryCount: number): void;
  /** Marks the entry for the input the player is composing — or none, if that input has not been tested. */
  setCurrent(query: OracleQuery | null): void;
  /** Brings an earlier entry into view and draws the eye to it. */
  recall(query: OracleQuery): void;
}

/**
 * The record of the investigation: everything the player has asked the
 * machine and what it answered (styles: `.log` in oracle.css). It only ever
 * grows, oldest entry at the top, like a printed log.
 *
 * It can also be consulted. The entry for the input the player is composing
 * is marked, and an entry can be recalled — brought into view and pointed out
 * — which is what happens instead of a query when an input is repeated.
 */
export function createExperimentLog(): ExperimentLog {
  const count = createElement('span', { className: 'log__count-value', text: formatCount(0) });
  const emptyNotice = createElement('p', { className: 'log__empty', text: 'NO QUERIES RECORDED' });
  const rows = createElement('tbody');
  /** The row of each entry, by query number. */
  const entries = new Map<number, HTMLTableRowElement>();

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
      createElement('p', { className: 'log__count' }, [createElement('span', { text: 'QUERIES USED' }), count]),
      emptyNotice,
      scrollArea,
    ],
  });
  element.classList.add('log');

  /**
   * Scrolls the log just far enough to show a row. Only the log's own scroll
   * position is touched: `scrollIntoView` would also be free to scroll the
   * page, which would slide the whole interface off the canvas beneath it.
   */
  function bringIntoView(row: HTMLTableRowElement): void {
    const headingHeight = table.tHead?.offsetHeight ?? 0; // The column headings stay put, covering the top of the scroll area.
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;

    if (rowTop < scrollArea.scrollTop + headingHeight) {
      scrollArea.scrollTop = rowTop - headingHeight;
    } else if (rowBottom > scrollArea.scrollTop + scrollArea.clientHeight) {
      scrollArea.scrollTop = rowBottom - scrollArea.clientHeight;
    }
  }

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
      entries.set(query.number, row);

      scrollArea.scrollTop = scrollArea.scrollHeight;
    },

    renderCount(queryCount) {
      count.textContent = formatCount(queryCount);
    },

    setCurrent(query) {
      rows.querySelector('[aria-current]')?.removeAttribute('aria-current');
      if (query) {
        entries.get(query.number)?.setAttribute('aria-current', 'true');
      }
    },

    recall(query) {
      const row = entries.get(query.number);
      if (!row) {
        return;
      }
      bringIntoView(row);
      rows.querySelector('[data-recalled]')?.removeAttribute('data-recalled');
      restartAnimation(row, 'data-recalled');
    },
  };
}
