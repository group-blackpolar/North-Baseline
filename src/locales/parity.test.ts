import assert from 'node:assert/strict';
import test from 'node:test';
import es from './es.ts'; import en from './en.ts';
import { authEs, authEn } from './auth.ts'; import { adminEs, adminEn } from './admin.ts'; import { mediaEs, mediaEn } from './media.ts';
import { assistantEs, assistantEn } from './assistant.ts'; import { pack12Es, pack12En } from './pack12.ts'; import { pack13Es, pack13En } from './pack13.ts';
import { studioEs, studioEn } from './studio.ts'; import { pack16Es, pack16En } from './pack16.ts';

const ES: Record<string, string> = { ...es, ...authEs, ...adminEs, ...mediaEs, ...assistantEs, ...pack12Es, ...pack13Es, ...studioEs, ...pack16Es };
const EN: Record<string, string> = { ...en, ...authEn, ...adminEn, ...mediaEn, ...assistantEn, ...pack12En, ...pack13En, ...studioEn, ...pack16En };
const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');

test('every interface key exists in both languages', () => {
  assert.deepEqual(Object.keys(ES).filter((key) => !(key in EN)), []);
  assert.deepEqual(Object.keys(EN).filter((key) => !(key in ES)), []);
});

test('interpolation variables match between languages and no value is empty', () => {
  const broken = Object.keys(ES).filter((key) => vars(ES[key]!) !== vars(EN[key] ?? '') || !ES[key]!.trim() || !EN[key]?.trim());
  assert.deepEqual(broken, []);
});
