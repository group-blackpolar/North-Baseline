import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyCounts } from './activitySeries.ts';

const now = new Date('2026-11-15T10:00:00Z');

test('events land in their UTC day, oldest first', () => {
  const { values, days } = dailyCounts(['2026-11-15T01:00:00Z', '2026-11-15T23:00:00Z', '2026-11-14T12:00:00Z', '2026-11-01T00:00:00Z'], 30, now);
  assert.equal(values.length, 30);
  assert.equal(values[29], 2);
  assert.equal(values[28], 1);
  assert.equal(values[15], 1);
  assert.equal(days[29]!.toISOString().slice(0, 10), '2026-11-15');
});

test('events outside the window and malformed dates are ignored', () => {
  const { values } = dailyCounts(['2026-09-01T00:00:00Z', 'not a date', '2027-01-01T00:00:00Z'], 30, now);
  assert.equal(values.reduce((sum, value) => sum + value, 0), 0);
});
