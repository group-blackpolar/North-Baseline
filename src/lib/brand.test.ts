import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { brandStyle, contrastRatio, isBrandHex, readableOn } from './brand.ts';

test('only #RRGGBB values are accepted as brand colors', () => {
  assert.equal(isBrandHex('#2F6FED'), true);
  assert.equal(isBrandHex('2F6FED'), false);
  assert.equal(isBrandHex('#2F6'), false);
  assert.equal(isBrandHex('red; background: url(x)'), false);
  assert.equal(isBrandHex(null), false);
});

test('shell style uses the accent, falls back to the primary and ignores invalid input', () => {
  assert.deepEqual(brandStyle({ brandPrimary: '#1B3A7A', brandAccent: '#2F6FED' }), { '--brand-accent': '#2F6FED', '--brand-primary': '#1B3A7A' });
  assert.deepEqual(brandStyle({ brandPrimary: '#1B3A7A' }), { '--brand-accent': '#1B3A7A', '--brand-primary': '#1B3A7A' });
  assert.equal(brandStyle({ brandAccent: 'javascript:alert(1)' }), undefined);
  assert.equal(brandStyle(null), undefined);
});

test('contrast helpers pick a readable foreground', () => {
  assert.ok(contrastRatio('#000000', '#FFFFFF') > 20);
  assert.equal(readableOn('#1B3A7A'), '#FFFFFF');
  assert.equal(readableOn('#F5E663'), '#16181D');
});
