import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyPeriod, describePeriod, monthBounds, presetBounds, yearBounds } from './periodModel.ts';

test('month and year bounds are closed calendar ranges', () => {
  assert.deepEqual(monthBounds('2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthBounds('2024-02-01'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(monthBounds('2025-12-31'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(yearBounds(2025), { from: '2025-01-01', to: '2025-12-31' });
});

test('presets anchor on the latest day with data and span whole months', () => {
  assert.deepEqual(presetBounds('lastMonth', '2026-08-31'), { from: '2026-08-01', to: '2026-08-31' });
  assert.deepEqual(presetBounds('last3Months', '2026-08-31'), { from: '2026-06-01', to: '2026-08-31' });
  assert.deepEqual(presetBounds('last12Months', '2026-08-15'), { from: '2025-09-01', to: '2026-08-31' });
  assert.deepEqual(presetBounds('last3Months', '2026-01-20'), { from: '2025-11-01', to: '2026-01-31' });
  assert.deepEqual(presetBounds('yearToDate', '2026-08-31'), { from: '2026-01-01', to: '2026-08-31' });
  assert.deepEqual(presetBounds('previousYear', '2026-08-31'), { from: '2025-01-01', to: '2025-12-31' });
});

test('selections are named when they are a whole month or year', () => {
  assert.deepEqual(classifyPeriod('2025-10-01', '2025-10-31'), { kind: 'month', label: '2025-10' });
  assert.deepEqual(classifyPeriod('2025-01-01', '2025-12-31'), { kind: 'year', label: '2025' });
  assert.deepEqual(classifyPeriod('2025-10-02', '2025-10-31'), { kind: 'range' });
  assert.deepEqual(classifyPeriod('2025-10-01', undefined), { kind: 'open' });
  assert.equal(describePeriod('2025-10-01', '2025-10-31', 'en'), 'October 2025');
  assert.equal(describePeriod('2025-01-01', '2025-12-31', 'en'), '2025');
  assert.equal(describePeriod('2025-10-02', '2025-10-31', 'en'), 'Oct 2, 2025 – Oct 31, 2025');
  assert.equal(describePeriod('2025-10-02', undefined, 'en'), '≥ Oct 2, 2025');
});
