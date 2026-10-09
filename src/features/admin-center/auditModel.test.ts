import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { auditCategory, emptyAuditFilters, filterAudit, groupByDay, type AuditLike } from './auditModel.ts';

const events: AuditLike[] = [
  { id: '1', actorId: 'u1', action: 'member.role_changed', targetType: 'membership', targetId: 'm1', createdAt: '2026-03-02T10:00:00Z', metadata: { from: 'VIEWER', to: 'ADMIN' } },
  { id: '2', actorId: 'u2', action: 'invitation.created', targetType: 'invitation', targetId: 'i1', createdAt: '2026-03-02T09:00:00Z' },
  { id: '3', actorId: null, action: 'panel.published', createdAt: '2026-03-01T09:00:00Z', requestId: 'req-9' },
];
const name = (id: string) => ({ u1: 'Ana Pérez', u2: 'Luis' }[id] ?? id);

test('categories come from the action prefix', () => {
  assert.equal(auditCategory('member.role_changed'), 'member');
  assert.equal(auditCategory('invitation:created'), 'invitation');
  assert.equal(auditCategory(''), 'other');
});

test('filters combine: category, actor, dates and accent-insensitive text over metadata and actor names', () => {
  const run = (patch: object) => filterAudit(events, { ...emptyAuditFilters(), ...patch }, name).map((e) => e.id);
  assert.deepEqual(run({}), ['1', '2', '3']);
  assert.deepEqual(run({ categories: ['member', 'panel'] }), ['1', '3']);
  assert.deepEqual(run({ actors: ['u2'] }), ['2']);
  assert.deepEqual(run({ from: '2026-03-02' }), ['1', '2']);
  assert.deepEqual(run({ to: '2026-03-01' }), ['3']);
  assert.deepEqual(run({ q: 'perez' }), ['1']);
  assert.deepEqual(run({ q: 'admin' }), ['1']);
  assert.deepEqual(run({ q: 'req-9' }), ['3']);
});

test('timeline groups by day keeping order', () => {
  assert.deepEqual(groupByDay(events).map((g) => [g.day, g.items.length]), [['2026-03-02', 2], ['2026-03-01', 1]]);
});
