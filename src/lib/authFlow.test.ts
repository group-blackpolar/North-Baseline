import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AUTH_FLOW_TTL_MS, clearAuthFlow, loadAuthFlow, resendSecondsLeft, saveAuthFlow, type FlowStorage } from './authFlow.ts';

const fake = (): FlowStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};

test('restores the verification step after the page was discarded', () => {
  const s = fake();
  saveAuthFlow({ email: ' Person@Example.com ', resendIn: 60 }, 1_000, s);
  const restored = loadAuthFlow(11_000, s);
  assert.equal(restored?.mode, 'verification');
  assert.equal(restored?.email, 'person@example.com');
  assert.equal(resendSecondsLeft(restored!, 11_000), 50);
});

test('never persists a password or a code', () => {
  const s = fake();
  saveAuthFlow({ email: 'a@b.co' }, 0, s);
  assert.deepEqual(Object.keys(JSON.parse(Object.values(s.data)[0]!)).sort(), ['email', 'expiresAt', 'mode', 'resendAt']);
});

test('an expired step is discarded and removed', () => {
  const s = fake();
  saveAuthFlow({ email: 'a@b.co' }, 0, s);
  assert.equal(loadAuthFlow(AUTH_FLOW_TTL_MS + 1, s), null);
  assert.deepEqual(s.data, {});
});

test('corrupt storage is ignored, not thrown', () => {
  const s = fake();
  s.setItem('north-auth-flow-v1', '{nope');
  assert.equal(loadAuthFlow(0, s), null);
  clearAuthFlow(s);
});
