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

test('UI directives: only the three known shapes with bounded fields are accepted', async () => {
  const { parseDirective, selectionsFromFilters } = await import('./directives.ts');
  assert.deepEqual(parseDirective({ type: 'open_panel', panelId: 'p1' }), { type: 'open_panel', panelId: 'p1' });
  assert.deepEqual(parseDirective({ type: 'clear_filters', panelId: 'p1' }), { type: 'clear_filters', panelId: 'p1' });
  const apply = parseDirective({ type: 'apply_filters', panelId: 'p1', filters: [{ fieldKey: 'country', values: ['CHINA'] }, { fieldKey: 'day', from: '2026-05-01', to: '2026-05-31' }] });
  assert.equal(apply?.type, 'apply_filters');
  assert.equal(apply?.type === 'apply_filters' && apply.replace, true);
  for (const bad of [null, 'x', { type: 'run_script', panelId: 'p1' }, { type: 'open_panel' }, { type: 'apply_filters', panelId: 'p1', filters: [] }, { type: 'apply_filters', panelId: 'p1', filters: [{ fieldKey: 'a' }] },
    { type: 'apply_filters', panelId: 'p1', filters: [{ fieldKey: 'a', values: Array.from({ length: 101 }, (_, i) => String(i)) }] }, { type: 'apply_filters', panelId: 'p1', filters: [{ fieldKey: 'a', values: [{}] }] },
    { type: 'open_panel', panelId: 'x'.repeat(200) }]) assert.equal(parseDirective(bad), null);
  const mapped = selectionsFromFilters(apply?.type === 'apply_filters' ? apply.filters : [], [{ fieldId: 'f-country', key: 'country' }, { fieldId: 'f-day', key: 'day' }]);
  assert.deepEqual(mapped.selections, { 'f-country': { values: ['CHINA'] }, 'f-day': { from: '2026-05-01', to: '2026-05-31' } });
  assert.deepEqual(selectionsFromFilters([{ fieldKey: 'shipper', text: 'x' }], [{ fieldId: 'f-country', key: 'country' }]).unresolved, ['shipper']);
});

test('chat state: directives arrive once, proposals wait for the user, and a replay never repeats either', () => {
  const ui = { type: 'apply_filters', panelId: 'p1', replace: true, filters: [{ fieldKey: 'country', values: ['CHINA'] }] };
  const events = [ev(1, 'tool.proposed', { toolCallId: 't1', name: 'views.apply_filters' }), ev(2, 'tool.completed', { toolCallId: 't1', name: 'views.apply_filters', ui }),
    ev(3, 'tool.completed', { toolCallId: 't2', name: 'views.panel.query', ui: { type: 'delete_everything', panelId: 'p1' } }),
    ev(4, 'action.proposed', { actionId: 'a1', toolName: 'views.category.create', summary: 'Create category "X"', expiresAt: '2026-10-12T00:00:00.000Z' })];
  const once = run(events);
  assert.equal(once.directives.length, 1, 'an unknown directive type is dropped');
  assert.deepEqual(once.actions.map((card) => [card.id, card.status]), [['a1', 'pending']]);
  const replay = events.reduce((state, event) => chatReducer(state, { type: 'event', event }), once);
  assert.equal(replay.directives.length, 1);
  assert.equal(replay.actions.length, 1);
  const decided = chatReducer(replay, { type: 'action.update', id: 'a1', status: 'confirmed' });
  assert.equal(decided.actions[0]!.status, 'confirmed');
  assert.equal(chatReducer(decided, { type: 'sending', localId: 'u2', text: 'otra' }).directives.length, 0, 'a new request starts without the previous directives');
});

test('panel bus: a request waits for its panel, is taken once and expires', async () => {
  const { consumePanelRequest, peekPanelRequest, postPanelRequest, resetPanelRequests, subscribePanelRequests } = await import('./panelBus.ts');
  resetPanelRequests();
  let notified = 0;
  const stop = subscribePanelRequests(() => { notified += 1; });
  postPanelRequest({ id: 'r1', panelId: 'p1', kind: 'apply', replace: true, filters: [{ fieldKey: 'country', values: ['CHINA'] }] }, 1_000);
  assert.equal(notified, 1);
  assert.equal(peekPanelRequest('p2', 2_000), null, 'another panel never sees it');
  assert.equal(peekPanelRequest('p1', 2_000)?.id, 'r1');
  consumePanelRequest('r1');
  assert.equal(peekPanelRequest('p1', 2_000), null, 'taken once');
  postPanelRequest({ id: 'r2', panelId: 'p1', kind: 'clear', replace: true, filters: [] }, 1_000);
  assert.equal(peekPanelRequest('p1', 1_000 + 61_000), null, 'a request nobody takes is dropped after a minute');
  stop();
  resetPanelRequests();
});
