import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyCameraError, cropWindow, fitSide, isHeif, mergeSelection, sha256Hex, sniffImageMime, stopStream, validateImage } from './logic.ts';

const f = (type: string, size = 100) => ({ type, size });

test('validateImage: format, size and empty', () => {
  assert.equal(validateImage(f('image/png')), null);
  assert.equal(validateImage(f('image/gif')), 'format');
  assert.equal(validateImage(f('image/png', 11 * 1024 * 1024)), 'size');
  assert.equal(validateImage(f('image/png', 0)), 'empty');
  assert.equal(validateImage(f('image/gif'), ['image/gif']), null);
});

test('sniffImageMime reads magic bytes', () => {
  assert.equal(sniffImageMime(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffImageMime(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0)), 'image/png');
  assert.equal(sniffImageMime(new TextEncoder().encode('RIFF....WEBP')), 'image/webp');
  assert.equal(sniffImageMime(new TextEncoder().encode('<svg xmlns=')), null);
});

test('mergeSelection: single replaces, multiple appends up to maxFiles, rejects invalid', () => {
  const a = f('image/png'), b = f('image/jpeg'), bad = f('image/gif');
  assert.deepEqual(mergeSelection([a], [b], { multiple: false, maxFiles: 5 }).next, [b]);
  const multi = mergeSelection([a], [b, bad, f('image/webp')], { multiple: true, maxFiles: 2 });
  assert.deepEqual(multi.next, [a, b]);
  assert.deepEqual(multi.rejected.map((r) => r.code), ['format', 'count']);
});

test('cropWindow: aspect, zoom and clamping', () => {
  const full = cropWindow(4000, 3000, 1, 1, 2000, 1500);
  assert.deepEqual([full.sw, full.sh, full.sx, full.sy], [3000, 3000, 500, 0]);
  const zoomed = cropWindow(4000, 3000, 16 / 9, 2, 0, 0); // pan far outside -> clamped to the corner
  assert.equal(zoomed.sx, 0);
  assert.equal(zoomed.sy, 0);
  assert.ok(Math.abs(zoomed.sw / zoomed.sh - 16 / 9) < 1e-9);
  assert.equal(zoomed.sw, 2000);
});

test('fitSide never upscales', () => {
  assert.deepEqual(fitSide(8000, 4000, 2000), { w: 2000, h: 1000 });
  assert.deepEqual(fitSide(100, 50, 2000), { w: 100, h: 50 });
});

test('classifyCameraError', () => {
  assert.equal(classifyCameraError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyCameraError({ name: 'NotFoundError' }), 'notfound');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }), 'busy');
  assert.equal(classifyCameraError(new Error('x')), 'error');
  assert.equal(classifyCameraError(null), 'error');
});

test('stopStream stops every track and tolerates null', () => {
  let stopped = 0;
  stopStream({ getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] });
  stopStream(null);
  assert.equal(stopped, 2);
});

test('sha256Hex matches the known vector', async () => {
  assert.equal(await sha256Hex(new Blob(['abc'])), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('isHeif recognises iOS HEIC/HEIF and nothing else', () => {
  const box = (brand: string) => Uint8Array.from([0, 0, 0, 24, ...new TextEncoder().encode(`ftyp${brand}`)]);
  assert.equal(isHeif(box('heic')), true);
  assert.equal(isHeif(box('mif1')), true);
  assert.equal(isHeif(box('isom')), false, 'mp4 is not an image');
  assert.equal(isHeif(Uint8Array.of(0x89, 0x50, 0x4e, 0x47)), false);
});
