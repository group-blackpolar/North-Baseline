import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { canUsePersonalWorkspace, resolveInitialOrganization } from './workspaceAccess.ts';

const P = 'personal';
const orgs = [{ id: P }, { id: 'a', slug: 'alpha' }, { id: 'b', slug: 'beta' }];
const base = { personalId: P, personalAllowed: true };

test('organization-created accounts cannot use Personal Workspace; e-mail format is irrelevant', () => {
  assert.equal(canUsePersonalWorkspace({ createdByOrganizationId: 'a' }), false);
  assert.equal(canUsePersonalWorkspace({ createdByOrganizationId: null }), true);
  assert.equal(canUsePersonalWorkspace({}), true);
});

test('organization-only account lands in its organization, never in Personal', () => {
  const r = resolveInitialOrganization(orgs, { ...base, personalAllowed: false, managedByOrganizationId: 'b' });
  assert.equal(r?.id, 'b');
});

test('without authorization Personal is never chosen even if present in the list', () => {
  assert.equal(resolveInitialOrganization(orgs, { ...base, personalAllowed: false })?.id, 'a');
  assert.equal(resolveInitialOrganization([{ id: P }], { ...base, personalAllowed: false }), null);
});

test('a deep link to a member organization wins; an unknown slug falls through', () => {
  assert.equal(resolveInitialOrganization(orgs, { ...base, routeSlug: 'beta' })?.id, 'b');
  assert.equal(resolveInitialOrganization(orgs, { ...base, routeSlug: 'ghost' })?.id, P);
});

test('authorized personal accounts keep Personal as default', () => {
  assert.equal(resolveInitialOrganization(orgs, base)?.id, P);
});
