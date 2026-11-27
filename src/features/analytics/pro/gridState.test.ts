import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPages, defaultView, fitPageRows, moveColumn, pageWindow, parseColumns, reconcileView, rowKeyOf, sparklineSeries, toggleColumn, trendDirection, visibleColumns } from './gridState.ts';

const label = (raw: unknown) => (typeof raw === 'object' && raw ? String((raw as Record<string, unknown>).es ?? '') : '');
const columns = parseColumns([
  { key: 'a', label: { es: 'A' }, kind: 'text' },
  { key: 'b', label: { es: 'B' }, kind: 'number', hidden: true },
  { key: 'c', label: { es: 'C' }, kind: 'bogus', width: 120 },
  { nope: true },
], label);

test('parseColumns keeps only well-formed columns and falls back on unknown kinds', () => {
  assert.deepEqual(columns.map((column) => [column.key, column.kind, column.hidden ?? false]), [['a', 'text', false], ['b', 'number', true], ['c', 'text', false]]);
  assert.deepEqual(parseColumns('x', label), []);
});

test('views reconcile with the current column set and order is user-controlled', () => {
  assert.deepEqual(visibleColumns(columns, defaultView(columns)).map((column) => column.key), ['a', 'c']);
  const stored = { order: ['c', 'gone', 'a'], hidden: ['a', 'gone'], widths: { c: 200, a: 5, gone: 90 } };
  const view = reconcileView(stored, columns);
  assert.deepEqual(view.order, ['c', 'a', 'b']);
  assert.deepEqual(view.hidden, ['a']);
  assert.deepEqual(view.widths, { c: 200 });
  assert.deepEqual(moveColumn(view, 'c', 1).order, ['a', 'c', 'b']);
  assert.deepEqual(moveColumn(view, 'c', -1).order, view.order, 'cannot move past the edge');
  assert.deepEqual(toggleColumn(view, 'a').hidden, []);
  assert.deepEqual(reconcileView('garbage', columns), defaultView(columns));
});

test('pageWindow shows the edges, a window around the current page and gaps', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 1426), [1, 2, 3, null, 1426]);
  assert.deepEqual(pageWindow(700, 1426), [1, null, 698, 699, 700, 701, 702, null, 1426]);
  assert.deepEqual(pageWindow(1426, 1426), [1, null, 1424, 1425, 1426]);
});

test('sparklines are built per row key, ordered by category, from numeric values only', () => {
  const rows = [
    { m: 'X', h: 'Y', month: '2025-10-01', n: 3 },
    { m: 'X', h: 'Y', month: '2025-08-01', n: 1 },
    { m: 'X', h: 'Y', month: '2025-09-01', n: 2 },
    { m: 'Z', h: 'Y', month: '2025-09-01', n: 7 },
    { m: 'Z', h: 'Y', month: '2025-10-01', n: null },
  ];
  const series = sparklineSeries(rows, ['m', 'h'], 'month', 'n');
  assert.deepEqual(series.get(rowKeyOf(rows[0]!, ['m', 'h'])), [1, 2, 3]);
  assert.deepEqual(series.get(rowKeyOf(rows[3]!, ['m', 'h'])), [7], 'null points are dropped, never plotted as zero');
  assert.equal(trendDirection([1, 2, 3]), 'up');
  assert.equal(trendDirection([3, 1]), 'down');
  assert.equal(trendDirection([4]), 'flat');
});

test('collectPages reads every page and says when rows are still missing', async () => {
  const server = (total: number, limit: number, offsets: number[] = []) => async (offset: number) => { offsets.push(offset); return { rows: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({ n: offset + i })) }; };
  for (const [total, limit, requests] of [[330, 1000, 1], [1439, 1000, 2], [2000, 1000, 3], [250, 100, 3]] as const) {
    const offsets: number[] = [];
    const all = await collectPages(server(total, limit, offsets));
    assert.equal(all.rows.length, total);
    assert.equal(all.complete, true);
    assert.equal(offsets.length, requests, `${total}/${limit}`);
    assert.equal(new Set(all.rows.map((row) => row.n)).size, total);
  }
  assert.equal((await collectPages(server(5000, 1000), 3)).complete, false);
  // A source that ignores the offset (anonymous showcase) is reported incomplete instead of duplicating rows.
  const stuck = await collectPages(async () => ({ rows: Array.from({ length: 100 }, (_, i) => ({ n: i })) }));
  assert.deepEqual([stuck.complete, stuck.rows.length], [false, 100]);
});

test('fitPageRows chooses rows that fit with the total and the horizontal scrollbar', () => {
  const cell = { width: 451, height: 673, head: 27.1, row: 22.55, foot: 32.4, tableMinWidth: 408, scrollbar: 10 };
  const fits = (input: typeof cell, rows: number) => 2 + input.head + input.foot + (input.tableMinWidth > input.width - 2 ? input.scrollbar : 0) + rows * input.row <= input.height;
  // Heights and widths around the ones where the old formula flipped between two sizes.
  for (let height = 300; height <= 900; height += 7) {
    for (const width of [300, 405, 409, 410, 411, 451]) {
      const input = { ...cell, height, width };
      const rows = fitPageRows(input);
      assert.ok(fits(input, rows), `${width}x${height}: ${rows} rows overflow`);
      assert.ok(!fits(input, rows + 1), `${width}x${height}: room is left for another row`);
    }
  }
  assert.equal(fitPageRows({ ...cell, foot: 0 }), fitPageRows(cell) + 1, 'the total takes the place of a row here');
  assert.equal(fitPageRows({ ...cell, height: 60 }), 3, 'never fewer than three rows');
});
