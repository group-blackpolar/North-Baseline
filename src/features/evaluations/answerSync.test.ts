import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AnswerSync, navigatorItems, remainingSeconds } from './answerSync.ts';
import { blocksToText, formatClock, formatPoints, hiddenBlockCount, optionLabel, questionIssues, textToBlocks, type AuthorQuestion } from './model.ts';

test('choosing queues a batch with an increasing seq; a later choice waits while one is in flight', () => {
  const sync = new AnswerSync();
  sync.choose('q1', 'a');
  assert.equal(sync.state, 'pending');
  const first = sync.nextBatch();
  assert.deepEqual(first, [{ questionId: 'q1', optionId: 'a', seq: 1 }]);
  assert.equal(sync.state, 'saving');
  sync.choose('q1', 'b');
  assert.deepEqual(sync.nextBatch(), [], 'one write per question in flight');
  sync.acknowledge(first, { status: 'IN_PROGRESS', applied: ['q1'], ignored: [], answers: [{ questionId: 'q1', optionId: 'a', seq: 1 }] });
  assert.equal(sync.selected('q1'), 'b', 'the newer local choice survives the older acknowledgement');
  assert.deepEqual(sync.nextBatch(), [{ questionId: 'q1', optionId: 'b', seq: 2 }]);
});

test('a reload resumes from the server answers and keeps counting above their seq', () => {
  const sync = new AnswerSync([{ questionId: 'q1', optionId: 'a', seq: 7 }]);
  assert.equal(sync.selected('q1'), 'a');
  assert.equal(sync.state, 'saved');
  assert.equal(sync.choose('q2', 'x'), 8);
  assert.equal(sync.answeredCount(), 2);
});

test('network failure keeps the answer queued with the same seq and reports offline with backoff', () => {
  const sync = new AnswerSync();
  sync.choose('q1', 'a');
  const batch = sync.nextBatch();
  sync.failed(batch);
  assert.equal(sync.state, 'offline');
  assert.equal(sync.retryDelayMs(), 1_000);
  const retry = sync.nextBatch();
  assert.deepEqual(retry, batch);
  sync.failed(retry); sync.failed(sync.nextBatch());
  assert.equal(sync.retryDelayMs(), 4_000);
  const last = sync.nextBatch();
  sync.acknowledge(last, { status: 'IN_PROGRESS', applied: ['q1'], ignored: [], answers: [{ questionId: 'q1', optionId: 'a', seq: 1 }] });
  assert.equal(sync.state, 'saved');
});

test('when the server holds a newer answer (another tab or device) it wins and is reported', () => {
  const sync = new AnswerSync([{ questionId: 'q1', optionId: 'a', seq: 1 }]);
  sync.choose('q1', 'b'); // seq 2
  const batch = sync.nextBatch();
  const result = sync.acknowledge(batch, { status: 'IN_PROGRESS', applied: [], ignored: ['q1'], answers: [{ questionId: 'q1', optionId: 'c', seq: 5 }] });
  assert.deepEqual(result.adopted, ['q1']);
  assert.equal(sync.selected('q1'), 'c');
  assert.equal(sync.choose('q1', 'd'), 6, 'later choices count above the server seq');
});

test('equal seq from two tabs: the server copy wins so both converge', () => {
  const sync = new AnswerSync();
  sync.choose('q1', 'mine'); // seq 1
  const batch = sync.nextBatch();
  sync.acknowledge(batch, { status: 'IN_PROGRESS', applied: [], ignored: ['q1'], answers: [{ questionId: 'q1', optionId: 'theirs', seq: 1 }] });
  assert.equal(sync.selected('q1'), 'theirs');
});

test('remaining time follows the server clock, not the client clock', () => {
  const base = { deadlineAt: '2026-01-01T00:10:00Z', serverTime: '2026-01-01T00:00:00Z', clientTimeAtLoad: 5_000_000 };
  assert.equal(remainingSeconds({ ...base, clientNow: 5_000_000 }), 600);
  assert.equal(remainingSeconds({ ...base, clientNow: 5_000_000 + 90_000 }), 510);
  assert.equal(remainingSeconds({ ...base, clientNow: 5_000_000 + 700_000 }), 0);
  assert.equal(remainingSeconds({ ...base, deadlineAt: null, clientNow: 1 }), null);
});

test('navigator marks current, answered and pending in order', () => {
  const items = navigatorItems(['a', 'b', 'c'], 1, (id) => id === 'a');
  assert.deepEqual(items.map((item) => [item.number, item.tone]), [[1, 'answered'], [2, 'current'], [3, 'pending']]);
});

test('text <-> blocks: paragraphs round-trip and non-text blocks are preserved, not dropped', () => {
  const previous = [{ type: 'paragraph' as const, text: 'old' }, { type: 'image' as const, assetId: 'a1', alt: 'x' }, { type: 'table' as const, header: ['h'], rows: [['v']] }];
  assert.equal(hiddenBlockCount(previous), 2);
  const next = textToBlocks('First\n\nSecond  \n\n\n\nThird', previous);
  assert.deepEqual(next.map((block) => block.type), ['paragraph', 'paragraph', 'paragraph', 'image', 'table']);
  assert.equal(blocksToText(next), 'First\n\nSecond\n\nThird');
  assert.deepEqual(textToBlocks('   '), []);
});

test('question readiness mirrors the publication rules', () => {
  const q: AuthorQuestion = { id: 'q', sectionId: 's', passageId: null, category: null, prompt: [{ type: 'paragraph', text: 'Q' }], options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a', explanation: [], points: 1 };
  assert.deepEqual(questionIssues(q), []);
  assert.deepEqual(questionIssues({ ...q, correctOptionId: null }), ['correct']);
  assert.deepEqual(questionIssues({ ...q, options: [{ id: 'a', text: '' }] }), ['options', 'optionText']);
});

test('small formatting helpers', () => {
  assert.equal(optionLabel(0) + optionLabel(4), 'AE');
  assert.equal(formatPoints(2), '2');
  assert.equal(formatPoints(1.5), '1.5');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(3725), '1:02:05');
});
