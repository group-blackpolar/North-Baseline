import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePassword, groupAliasSlug, previewAddress, previewLocalPart } from './credentials.ts';

test('generated passwords follow ORG-PASS-<10 chars> and differ each time', () => {
  assert.match(generatePassword('shark'), /^SHARK-PASS-[A-Za-z0-9]{10}$/);
  assert.match(generatePassword('my-org'), /^MYORG-PASS-[A-Za-z0-9]{10}$/);
  assert.notEqual(generatePassword('shark'), generatePassword('shark'));
  assert.ok(generatePassword('shark').length >= 12);
});

test('the preview address uses the first word of the name without accents', () => {
  assert.equal(previewLocalPart('Samuel Pérez'), 'samuel');
  assert.equal(previewLocalPart('  Ángela  '), 'angela');
  assert.equal(previewLocalPart(''), 'usuario');
});

test('group alias fragment and previewed address mirror the server rules', () => {
  assert.equal(groupAliasSlug('Finanzas Chile'), 'finanzaschile');
  assert.equal(groupAliasSlug('Operación Ñuñoa'), 'operacionnunoa');
  assert.equal(groupAliasSlug('!!!'), 'grupo');
  assert.equal(groupAliasSlug('x'.repeat(80)).length, 20);
  assert.equal(previewAddress('Camila Rojas', 'Shark'), 'camila@shark.bp');
  assert.equal(previewAddress('Camila Rojas', 'Shark', 'Finanzas Chile'), 'camila.finanzaschile@shark.bp');
});
