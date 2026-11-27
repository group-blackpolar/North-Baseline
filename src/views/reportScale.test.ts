import assert from 'node:assert/strict';
import test from 'node:test';
import { measuredReport, REPORT_PADDING, fitContentHeight, reportMode, reportScale, type ScaleSection } from './reportScale.ts';

const at = (id: string, type: string, y: number, h: number, props?: Record<string, unknown>) => ({ id, type, props, layout: { desktop: { y, h } } });

test('mode follows the measured width', () => {
  assert.equal(reportMode(390), 'phone');
  assert.equal(reportMode(599), 'phone');
  assert.equal(reportMode(600), 'tablet');
  assert.equal(reportMode(899), 'tablet');
  assert.equal(reportMode(900), 'screen');
});

test('a fitted report scales by the tighter dimension and never leaves [0.6, 1]', () => {
  assert.equal(reportScale({ width: 1650, height: 900 }, true), 0.82);
  assert.equal(reportScale({ width: 3000, height: 2000 }, true), 1);
  assert.equal(reportScale({ width: 1200, height: 400 }, true), 0.6, 'a very short viewport hits the floor, it never shrinks further');
  assert.equal(reportScale({ width: 900, height: 1400 }, true), 0.6, 'width is the tighter side');
  assert.equal(reportScale({ width: 1170, height: 1400 }, true), 0.78);
});

test('the scale follows the content: a short report is not shrunk as if it were tall', () => {
  const size = { width: 1600, height: 650 };
  assert.equal(reportScale(size, true, 1100), 0.6);
  assert.equal(reportScale(size, true, 700), 0.93, 'a 700px-tall matrix fits 650px at 0.93');
  assert.equal(reportScale({ width: 1170, height: 780 }, true, 1094), 0.71);
});

test('a scrolling report only keeps a legible floor and ignores height', () => {
  assert.equal(reportScale({ width: 1650, height: 40 }, false), 1);
  assert.equal(reportScale({ width: 800, height: 0 }, false), 0.8);
  assert.equal(reportScale({ width: 1300, height: 0 }, false), 0.87);
});

test('an unmeasured report renders at full scale', () => {
  assert.equal(reportScale({ width: 0, height: 0 }, true), 1);
});

test('fitContentHeight: tallest fit section = rows x rowHeight + gaps + chrome; grouped members and the filter band do not count', () => {
  const real: ScaleSection = { layout: { rowHeight: 16, fit: true, gap: 'md' }, components: [at('t', 'title_bar', 0, 2), at('f', 'filter_bar', 2, 3), at('k', 'kpi_card', 3, 6), at('g', 'data_grid', 9, 21)] };
  // band = 5 (2+3), bottom = 30 -> 25 rows
  assert.equal(fitContentHeight([real]), 25 * 16 + 24 * 16 + 150);
  const grouped: ScaleSection = { layout: { rowHeight: 16, fit: true }, components: [at('a', 'panel_group', 0, 10, { items: [{ componentId: 'm' }] }), at('m', 'geo_map', 40, 99)] };
  assert.equal(fitContentHeight([grouped]), 10 * 16 + 9 * 16 + 150, 'a grouped member is drawn inside its group, not at its own cell');
  assert.equal(fitContentHeight([{ layout: { rowHeight: 16 }, components: [at('a', 'card', 0, 4)] }]), null, 'not fit: scrolls');
  assert.equal(fitContentHeight([{ layout: {}, components: [] }]), null);
});

test('the measured size ignores whatever the padding takes, so the scale cannot feed back into itself', () => {
  const element = { offsetWidth: 1124, offsetHeight: 900 };
  // The same element reads the same whatever scale its padding was drawn at.
  assert.deepEqual(measuredReport(element, true), { width: 1124 - REPORT_PADDING, height: 900 - REPORT_PADDING });
  assert.deepEqual(measuredReport(element, false), { width: 1124 - REPORT_PADDING, height: 0 });
  assert.deepEqual(measuredReport({ offsetWidth: 10, offsetHeight: 10 }, true), { width: 0, height: 0 });
  const scale = reportScale(measuredReport(element, true), true, 940);
  assert.equal(reportScale(measuredReport(element, true), true, 940), scale);
});
