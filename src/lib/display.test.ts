import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTheme } from './theme.ts';
import { AUTO_COMPACT_BELOW, resolveDensity } from './density.ts';

test('system theme follows the OS; concrete themes never change', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  for (const theme of ['light', 'dark', 'midnight'] as const) assert.equal(resolveTheme(theme, theme === 'light'), theme);
});

test('auto density is compact below the threshold and standard above; explicit choices win', () => {
  assert.equal(resolveDensity('auto', AUTO_COMPACT_BELOW - 1), 'compact');
  assert.equal(resolveDensity('auto', AUTO_COMPACT_BELOW), 'standard');
  assert.equal(resolveDensity('comfortable', 800), 'comfortable');
  assert.equal(resolveDensity('compact', 2560), 'compact');
});
