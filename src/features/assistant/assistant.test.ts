import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { chatReducer, errorKind, initialChatState, isTerminal, reconnectDelay, SseParser, type ChatState, type SseEvent } from './protocol.ts';
import { parseBlocks, parseInline } from './richText.ts';

const frame = (id: number, type: string, data: unknown) => `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const ev = (id: number, type: string, data: unknown = {}): SseEvent => ({ id, type, data });
const run = (events: SseEvent[], start: ChatState = chatReducer(initialChatState, { type: 'sending', localId: 'u1', text: 'hola' })) =>
  events.reduce((state, event) => chatReducer(state, { type: 'event', event }), chatReducer(start, { type: 'run.created', runId: 'r1' }));

test('SSE parser: events split across chunks, CRLF, heartbeats and multi-line data', () => {
  const parser = new SseParser();
  const whole = frame(1, 'run.started', { runId: 'r' }) + ': heartbeat\n\n' + frame(2, 'message.delta', { text: 'Ho' });
  const out: SseEvent[] = [];
  for (let i = 0; i < whole.length; i += 7) out.push(...parser.push(whole.slice(i, i + 7)));
  assert.deepEqual(out.map((e) => [e.id, e.type]), [[1, 'run.started'], [2, 'message.delta']]);
  assert.deepEqual(out[1]!.data, { text: 'Ho' });
  assert.deepEqual(new SseParser().push('id: 3\r\nevent: x\r\ndata: a\r\ndata: b\r\n\r\n')[0], { id: 3, type: 'x', data: 'a\nb' });
  assert.deepEqual(new SseParser().push('data: not json\n\n')[0]!.data, 'not json');
  assert.equal(new SseParser().push(': only a comment\n\n').length, 0);
});

test('terminal events end the stream', () => {
  for (const type of ['run.completed', 'run.failed', 'run.cancelled']) assert.equal(isTerminal(ev(1, type)), true);
  assert.equal(isTerminal(ev(1, 'message.delta')), false);
});

test('a normal run streams deltas, shows tool steps, and the completed text is authoritative', () => {
  const state = run([
    ev(1, 'run.started'),
    ev(2, 'message.delta', { text: 'Voy a mirar. ' }),
    ev(3, 'tool.proposed', { toolCallId: 't1', name: 'user.permissions' }),
    ev(4, 'tool.started', { toolCallId: 't1', name: 'user.permissions' }),
    ev(5, 'tool.completed', { toolCallId: 't1', name: 'user.permissions' }),
    ev(6, 'message.delta', { text: 'Puedes ver' }),
    ev(7, 'message.completed', { text: 'Puedes ver documentos.' }),
    ev(8, 'run.completed'),
  ]);
  assert.equal(state.phase, 'idle');
  assert.deepEqual(state.tools, [{ id: 't1', name: 'user.permissions', status: 'done' }]);
  assert.deepEqual(state.messages.map((m) => [m.role, m.text, m.pending ?? false]), [['user', 'hola', false], ['assistant', 'Puedes ver documentos.', false]]);
});

test('replay after a reconnect is idempotent (events at or below the last sequence are ignored)', () => {
  const first = run([ev(1, 'run.started'), ev(2, 'message.delta', { text: 'Ho' })]);
  const replayed = [ev(1, 'run.started'), ev(2, 'message.delta', { text: 'Ho' }), ev(3, 'message.delta', { text: 'la' })]
    .reduce((state, event) => chatReducer(state, { type: 'event', event }), first);
  assert.equal(replayed.messages.at(-1)!.text, 'Hola');
  assert.equal(replayed.lastSequence, 3);
});

test('failure, cancellation and empty placeholders', () => {
  const failed = run([ev(1, 'run.started'), ev(2, 'run.failed', { code: 'AI_PROVIDER_RATE_LIMITED' })]);
  assert.equal(failed.phase, 'idle');
  assert.equal(failed.error, 'AI_PROVIDER_RATE_LIMITED');
  assert.deepEqual(failed.messages.map((m) => m.role), ['user'], 'the empty assistant placeholder is dropped');

  const cancelled = run([ev(1, 'run.started'), ev(2, 'message.delta', { text: 'Parcial' }), ev(3, 'run.cancelled', { code: 'AI_RUN_CANCELLED' })]);
  assert.deepEqual(cancelled.messages.at(-1), { id: 'u1-reply', role: 'assistant', text: 'Parcial', pending: false, stopped: true });
  assert.equal(cancelled.error, null);

  assert.equal(chatReducer(chatReducer(initialChatState, { type: 'sending', localId: 'a', text: 'x' }), { type: 'failed', code: 'RATE_LIMITED' }).error, 'RATE_LIMITED');
});

test('switching organization or starting over leaves nothing behind', () => {
  const busy = run([ev(1, 'run.started'), ev(2, 'message.delta', { text: 'secreto de la org A' })]);
  assert.deepEqual(chatReducer(busy, { type: 'reset' }), initialChatState);
});

test('loading a stored conversation hides internal tool rows', () => {
  const loaded = chatReducer(initialChatState, { type: 'loaded', conversationId: 'c1', messages: [
    { id: '1', role: 'USER', content: 'hola' }, { id: '2', role: 'TOOL', content: '{"role":"VIEWER"}' }, { id: '3', role: 'ASSISTANT', content: 'Hola' },
  ] });
  assert.deepEqual(loaded.messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(loaded.conversationId, 'c1');
});

test('error classification and reconnect backoff', () => {
  assert.equal(errorKind('AI_DISABLED'), 'unavailable');
  assert.equal(errorKind('AI_PROVIDER_RATE_LIMITED'), 'rateLimited');
  assert.equal(errorKind(undefined, 429), 'rateLimited');
  assert.equal(errorKind('AI_CONCURRENCY_LIMITED'), 'busy');
  assert.equal(errorKind('AI_PROVIDER_TIMEOUT'), 'timeout');
  assert.equal(errorKind('AI_PERMISSION_DENIED'), 'forbidden');
  assert.equal(errorKind('anything-else'), 'generic');
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => reconnectDelay(n)), [500, 1000, 2000, 4000, 8000]);
  assert.equal(reconnectDelay(5), null);
});

test('rich text never produces markup: tags, links and images stay literal text', () => {
  assert.deepEqual(parseInline('a **b** `c` <img src=x onerror=alert(1)> [x](javascript:alert(1))'), [
    { kind: 'text', value: 'a ' }, { kind: 'bold', value: 'b' }, { kind: 'text', value: ' ' }, { kind: 'code', value: 'c' },
    { kind: 'text', value: ' <img src=x onerror=alert(1)> [x](javascript:alert(1))' },
  ]);
  const blocks = parseBlocks('Pasos:\n1. Abre el perfil\n2. Elige **Cambiar foto**\n\n- uno\n- dos\n\nFin');
  assert.deepEqual(blocks.map((b) => b.kind), ['p', 'ol', 'ul', 'p']);
  assert.equal((blocks[1] as { items: unknown[] }).items.length, 2);
});
