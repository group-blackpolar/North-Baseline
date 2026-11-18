import assert from 'node:assert/strict';
import test from 'node:test';
import { reportMode, reportScale } from './reportScale.ts';

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
  assert.equal(reportScale({ width: 1600, height: 1400 }, true), 0.8, 'width is the tighter side');
  assert.equal(reportScale({ width: 1600, height: 500 }, true), 0.6);
});

test('a scrolling report only keeps a legible floor and ignores height', () => {
  assert.equal(reportScale({ width: 1650, height: 40 }, false), 0.83);
  assert.equal(reportScale({ width: 800, height: 0 }, false), 0.8);
  assert.equal(reportScale({ width: 2400, height: 0 }, false), 1);
});

test('an unmeasured report renders at full scale', () => {
  assert.equal(reportScale({ width: 0, height: 0 }, true), 1);
});
