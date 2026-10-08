import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CameraController, type Facing, type StreamLike, type TrackLike } from './camera-controller.ts';

function fakeHost() {
  const streams: { stream: StreamLike; track: TrackLike; stopped: () => boolean; facing: Facing }[] = [];
  const pending: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
  let manual = false;
  let failWith: unknown = null;
  return {
    streams,
    pending,
    holdNext() { manual = true; },
    failNext(error: unknown) { failWith = error; },
    live: () => streams.filter((entry) => !entry.stopped()).length,
    host: {
      getUserMedia(facing: Facing) {
        return new Promise<StreamLike>((resolve, reject) => {
          const go = () => {
            if (failWith) { const error = failWith; failWith = null; reject(error); return; }
            let stopped = false;
            const track: TrackLike = { stop: () => { stopped = true; }, onended: null };
            const stream = { getTracks: () => [track] };
            streams.push({ stream, track, stopped: () => stopped, facing });
            resolve(stream);
          };
          if (manual) { manual = false; pending.push({ resolve: go, reject }); } else go();
        });
      },
    },
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('opens only when active, and releases every track when deactivated', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  c.set({ visible: true });
  await flush();
  assert.equal(h.streams.length, 0, 'nothing opens before the flow asks for the camera');
  c.set({ active: true });
  await flush();
  assert.equal(c.state, 'ready');
  assert.equal(h.live(), 1);
  c.set({ active: false });
  assert.equal(h.live(), 0);
  assert.equal(c.state, 'idle');
  c.dispose();
});

test('hiding the page stops the tracks; showing it again restarts without a second stream', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  c.set({ active: true });
  await flush();
  c.set({ visible: false });
  assert.equal(h.live(), 0);
  c.set({ visible: true });
  await flush();
  assert.equal(c.state, 'ready');
  assert.equal(h.live(), 1);
  assert.equal(h.streams.length, 2);
});

test('a resume that needs a user gesture becomes "interrupted", and retry recovers', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  c.set({ active: true });
  await flush();
  c.set({ visible: false });
  h.failNext({ name: 'NotAllowedError' });
  c.set({ visible: true });
  await flush();
  assert.equal(c.state, 'interrupted');
  c.retry();
  await flush();
  assert.equal(c.state, 'ready');
  assert.equal(h.live(), 1);
});

test('a first-time permission denial stays "denied", not "interrupted"', async () => {
  const h = fakeHost();
  h.failNext({ name: 'NotAllowedError' });
  const c = new CameraController(h.host, () => {});
  c.set({ active: true });
  await flush();
  assert.equal(c.state, 'denied');
});

test('the OS taking the camera (track ended) releases the stream and asks for a resume', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  c.set({ active: true });
  await flush();
  h.streams[0]!.track.onended?.();
  assert.equal(c.state, 'interrupted');
  assert.equal(h.live(), 0);
});

test('rapid flip and close never leave a live stream behind (late stream is stopped)', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  h.holdNext();
  c.set({ active: true });                 // request #1 held
  h.holdNext();
  c.set({ facing: 'user' });               // request #2 held, supersedes #1
  c.set({ active: false });                // closed before either resolved
  h.pending[0]!.resolve();
  h.pending[1]!.resolve();
  await flush();
  assert.equal(h.streams.length, 2);
  assert.equal(h.live(), 0, 'both late streams were stopped');
  assert.equal(c.state, 'idle');
});

test('flip while open swaps the stream: old one stopped before the new one is kept', async () => {
  const h = fakeHost();
  const c = new CameraController(h.host, () => {});
  c.set({ active: true });
  await flush();
  c.set({ facing: 'user' });
  await flush();
  assert.equal(h.live(), 1);
  assert.equal(h.streams.at(-1)!.facing, 'user');
  assert.equal(h.streams[0]!.stopped(), true);
  c.set({ facing: 'user' });               // same facing: no restart
  await flush();
  assert.equal(h.streams.length, 2);
});
