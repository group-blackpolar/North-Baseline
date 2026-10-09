/* Development-only: installs a mocked CORECROW API, then boots the real app. Not bundled in production. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const user = {
  id: 'user-1', email: 'sam@blackpolar.org', name: 'Samuel Blanquicett', role: new URLSearchParams(window.location.search).get('role') ?? 'USER', emailVerified: true,
  passwordChangeRequired: false, termsAcceptedAt: '2026-09-16T00:00:00.000Z', termsVersion: '2026-09-16', createdAt: '2026-09-01T00:00:00.000Z',
};
const organizations = [
  { id: 'org-seminsa', name: 'Seminsa', slug: 'seminsa' },
  { id: 'org-northwind', name: 'Northwind', slug: 'northwind' },
  { id: 'org-acme', name: 'Acme Logistics', slug: 'acme' },
];
const label = (es: string, en: string) => ({ es, en });
const navigation = [
  { id: 'cat-formas', name: label('Formas', 'Forms'), icon: 'FileText', color: null, slug: 'formas', subcategories: [
    { id: 'sub-formas', name: label('Formas', 'Forms'), icon: null, slug: 'formas', panels: [{ id: 'panel-formas', name: label('Formas', 'Forms'), icon: null, slug: 'formas', status: 'PUBLISHED' }] },
  ] },
  { id: 'cat-reports', name: label('Reportes', 'Reports'), icon: 'chart', color: null, slug: 'reportes', subcategories: [
    { id: 'sub-overview', name: label('Resumen', 'Overview'), icon: null, slug: 'resumen', panels: [] },
    { id: 'sub-monthly', name: label('Mensual', 'Monthly'), icon: null, slug: 'mensual', panels: [] },
    { id: 'sub-annual', name: label('Anual', 'Annual'), icon: null, slug: 'anual', panels: [] },
  ] },
  { id: 'cat-admin', name: label('Administración', 'Administration'), icon: 'shield', color: null, slug: 'admin', subcategories: [
    { id: 'sub-settings', name: label('Configuración', 'Settings'), icon: null, slug: 'settings', panels: [] },
  ] },
  { id: 'cat-files', name: label('Archivos', 'Files'), icon: 'db', color: null, slug: 'archivos', subcategories: [
    { id: 'sub-all', name: label('Todos', 'All'), icon: null, slug: 'todos', panels: [] },
  ] },
];
const type = { id: 'type-forma', key: 'forma', name: label('Forma', 'Form'), referencePrefix: 'SEM', currency: 'USD' };
const clients = ['Empresa XYZ, S.A.', 'Constructora Delta', 'Hotel Costa Azul', 'Farmacias Unidas', 'Taller Mecánico Rivera', 'Distribuidora Norte'];
const statuses = ['SENT', 'DRAFT', 'COMPLETED', 'READY', 'CANCELLED', 'SENT'];
const documents = clients.map((client, index) => ({
  id: `doc-${21 - index}`, reference: `SEM-${String(21 - index).padStart(6, '0')}`, status: statuses[index], typeKey: 'forma', clientName: client,
  date: new Date(Date.UTC(2026, 9, 6 - index, 12)).toISOString(), total: ['1240.00', '350.00', '90.00', '2180.50', '415.25', '760.00'][index], currency: 'USD', updatedAt: new Date().toISOString(),
}));
const detail = (id: string) => {
  const row = documents.find((item) => item.id === id) ?? documents[0]!;
  return {
    id: row.id, reference: row.reference, status: row.status, allowedTransitions: row.status === 'READY' ? ['DRAFT', 'SENT', 'COMPLETED', 'CANCELLED'] : row.status === 'DRAFT' ? ['READY', 'CANCELLED'] : [], editable: row.status === 'DRAFT' || row.status === 'READY',
    type: { id: type.id, key: type.key, name: type.name, referencePrefix: 'SEM' }, date: row.date, client: { id: 'client-1', name: row.clientName, email: 'compras@xyz.example', phone: '+507 6000-0000' },
    comments: 'Se recomienda revisión en 6 meses.\nGracias por su preferencia.', currency: 'USD',
    items: [
      { id: 'i1', position: 0, name: 'Mantenimiento preventivo', description: 'Revisión completa y calibración', sku: null, unit: null, quantity: '2', unitPrice: '20.00', total: '40.00' },
      { id: 'i2', position: 1, name: 'Repuesto: filtro de aire', description: '', sku: null, unit: null, quantity: '1', unitPrice: '15.00', total: '15.00' },
    ],
    subtotal: '55.00', discountTotal: '0.00', taxTotal: '0.00', total: '55.00', attachments: [], version: 1, createdBy: 'user-1', createdAt: row.date, updatedAt: row.date,
  };
};
const events = [
  { id: 'e3', action: 'DOCUMENT_EMAIL_SENT', actorId: 'user-1', actorName: 'Samuel Blanquicett', createdAt: new Date().toISOString(), metadata: { to: 'c***@xyz.example' } },
  { id: 'e2', action: 'DOCUMENT_STATUS_CHANGED', actorId: 'user-1', actorName: 'Samuel Blanquicett', createdAt: new Date(Date.now() - 3600_000).toISOString(), metadata: { from: 'DRAFT', to: 'READY' } },
  { id: 'e1', action: 'DOCUMENT_CREATED', actorId: 'user-1', actorName: 'Samuel Blanquicett', createdAt: new Date(Date.now() - 7200_000).toISOString(), metadata: {} },
];

// ---- Administration fixtures (dummy data; development harness only) ----
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const people = [
  ['Samuel Figueroa', 'samuel.figueroa@blackpolar.example', 'SUPERADMIN'], ['María Fernanda Castellanos-Villarreal de la Torre', 'maria.fernanda.castellanos.villarreal@distribuidora-norte-internacional.example', 'ADMIN'],
  ['Luis Ortega', 'luis@xyz.example', 'USER'], ['Ana Paula Robles', 'ana.robles@hotelcostaazul.example', 'USER'], ['Carlos Medina', 'cmedina@constructoradelta.example', 'DEVELOPER'], ['Elena Ruiz', 'elena@farmaciasunidas.example', 'USER'],
] as const;
const platformUsers = people.map(([name, email, role], index) => ({ id: `u-${index}`, email, name, role, status: index === 4 ? 'SUSPENDED' : 'ACTIVE', emailVerified: index !== 3, passwordChangeRequired: false, termsAcceptedAt: ago(500), termsVersion: '2026-09-16', createdAt: ago(900 + index * 40) }));
const platformOrgs = [['Seminsa', 'seminsa', 'ACTIVE'], ['Northwind', 'northwind', 'ACTIVE'], ['Acme Logistics & Distribución Internacional de Carga Pesada S.A.', 'acme', 'SUSPENDED'], ['Hotel Costa Azul', 'costa-azul', 'ARCHIVED']].map(([name, slug, status], index) => ({
  id: `o-${index}`, name, slug, status, createdAt: ago(2000 + index * 100), updatedAt: ago(30 + index), homePanelId: null, owner: { id: `u-${index}`, name: people[index]![0], email: people[index]![1] }, memberCount: 3 + index * 4, groupCount: index, billingStatus: ['ACTIVE', 'ACTIVE', 'PAST_DUE', 'CLOSED'][index], billingCurrency: 'USD',
}));
const tenantMembers = people.map(([name, email], index) => ({ id: `m-${index}`, organizationId: 'org-seminsa', userId: `u-${index}`, role: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'BILLING_ADMIN', 'MEMBER'][index], createdAt: ago(800), email, name, status: index === 4 ? 'SUSPENDED' : 'ACTIVE' }));
const tenantInvitations = [
  { id: 'i-1', kind: 'EMAIL', email: 'nueva.persona.con.un.correo.demasiado.largo@subdominio.empresa-de-prueba.example', role: 'MEMBER', status: 'PENDING', expiresAt: ago(-60), acceptedAt: null, revokedAt: null, createdAt: ago(12), groupIds: [], permissions: [] },
  { id: 'i-2', kind: 'CODE', email: null, role: 'VIEWER', status: 'EXPIRED', expiresAt: ago(10), acceptedAt: null, revokedAt: null, createdAt: ago(100), groupIds: [], permissions: [] },
];
const tenantGroups = [{ id: 'g-1', name: 'Facturación', description: 'Emite y envía formas', memberUserIds: ['u-0', 'u-2'], permissions: ['documents.read', 'documents.create'] }, { id: 'g-2', name: 'Solo lectura', description: null, memberUserIds: [], permissions: ['documents.read'] }];
const audit = Array.from({ length: 8 }, (_, i) => ({ id: `a-${i}`, actorId: `u-${i % 3}`, organizationId: 'o-0', action: ['organization.member.role_changed', 'document.sent', 'auth.login', 'invitation.created'][i % 4], targetType: 'USER', targetId: `u-${i}`, requestId: `req-${1000 + i}`, metadata: {}, createdAt: ago(i * 5) }));
const summary = { users: { total: 128, active: 120, suspended: 8, verified: 110, createdLast7Days: 6, createdLast30Days: 21 }, organizations: { total: 14, active: 12, suspended: 2, createdLast30Days: 3 }, memberships: { total: 96 }, sessions: { active: 17 }, storage: { usedBytes: '5368709120', limitBytes: '107374182400', reservedBytes: '1073741824' }, billing: { currency: 'USD', basePriceMinor: 4900, memberPriceMinor: 900, billableOrganizationCount: 12, billableMemberCount: 84, estimatedMonthlyMinor: 134400 }, generatedAt: ago(0) };
const billing = { currency: 'USD', basePriceMinor: 4900, memberPriceMinor: 900, groupsCostMinor: 0, organizationCount: 14, billableMemberCount: 84, estimatedMonthlyMinor: 134400, byStatusScope: 'ALL_PROFILES', byStatus: [{ status: 'ACTIVE', count: 12 }, { status: 'PAST_DUE', count: 1 }, { status: 'CLOSED', count: 1 }] };
const contacts = [{ id: 'c-1', name: 'Roberto Alvarado', email: 'roberto@empresa-con-dominio-largo.example', organization: 'Importadora Pacífico', country: 'PA', project: 'Control de contenedores', message: 'Nos gustaría una demostración.', locale: 'es-lat', createdAt: ago(20), consentAt: ago(20) }];
const adminPage = (items: unknown[]) => json({ items, nextCursor: null });
const adminMock = (path: string, method = 'GET', body = ''): Response | null => {
  if (method === 'POST' && path === '/v1/platform/users') {
    const input = JSON.parse(body || '{}') as { name: string; email: string; role: string; passwordChangeRequired: boolean };
    if (platformUsers.some((u) => u.email === input.email.toLowerCase())) return json({ error: { code: 'IDENTITY_EXISTS', message: 'An identity with this email already exists' } }, 409);
    const created = { id: `u-new-${platformUsers.length}`, email: input.email.toLowerCase(), name: input.name, role: input.role, status: 'ACTIVE', emailVerified: true, passwordChangeRequired: input.passwordChangeRequired, termsAcceptedAt: null, termsVersion: null, createdAt: ago(0) };
    platformUsers.unshift(created as (typeof platformUsers)[number]);
    return json(created, 201);
  }
  const verifyMatch = method === 'POST' && path.match(/^\/v1\/platform\/users\/([^/]+)\/verify-email$/);
  if (verifyMatch) {
    const target = platformUsers.find((u) => u.id === verifyMatch[1]);
    if (!target) return json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    target.emailVerified = true;
    return json(target);
  }
  if (path === '/v1/platform/summary') return json(summary);
  if (path === '/v1/platform/users') return adminPage(platformUsers);
  if (/^\/v1\/platform\/users\/[^/]+\/north-capabilities$/.test(path)) return json([]);
  if (/^\/v1\/platform\/users\/[^/]+$/.test(path)) return json({ ...(platformUsers.find((u) => u.id === path.split('/').pop()) ?? platformUsers[0]), memberships: [] });
  if (path === '/v1/platform/organizations') return adminPage(platformOrgs);
  if (/^\/v1\/platform\/organizations\/[^/]+$/.test(path)) return json({ ...platformOrgs[0], invitationCount: 2, groups: [], billingProfile: null });
  if (path === '/v1/platform/audit') return adminPage(audit);
  if (path === '/v1/platform/billing/summary') return json(billing);
  if (path === '/v1/contact') return json(contacts);
  if (path === '/v1/platform/north/templates') return json([]);
  if (/\/members$/.test(path)) return json(tenantMembers);
  if (/\/invitations$/.test(path)) return json(tenantInvitations);
  if (/\/groups$/.test(path)) return json(tenantGroups);
  if (/\/permission-grants$/.test(path)) return json([]);
  return null;
};

const LATENCY = Number(new URLSearchParams(window.location.search).get('latency') ?? 120);
const original = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  const path = url.pathname;
  if (!path.startsWith('/v1/')) return original(input, init);
  // ?latency=ms simulates a slow API (default 120) to inspect delayed skeletons and keep-previous-data.
  await new Promise((resolve) => setTimeout(resolve, LATENCY));
  if (path === '/v1/organizations' && init?.method === 'POST') return json({ id: 'org-new', name: 'Nueva org', slug: 'nueva-org' }, 201);
  const admin = adminMock(path, init?.method, typeof init?.body === 'string' ? init.body : '');
  if (admin) return admin;
  if (path === '/v1/auth/get-session') return json({ user });
  if (path === '/v1/identity/config') return json({ termsVersion: '2026-09-16', passwordMinLength: 12, passwordMaxLength: 128, googleAuthEnabled: false, captchaRequired: false });
  if (path === '/v1/me') return json(user);
  if (path === '/v1/organizations') return json(organizations);
  if (/\/permissions$/.test(path)) return json({ role: 'OWNER', permissions: ['organization.read', 'members.read', 'members.manage', 'groups.read', 'invitations.manage', 'permissions.manage', 'documents.read', 'documents.create', 'documents.update', 'documents.delete', 'documents.download', 'documents.send', 'documents.manage'] });
  if (/\/navigation$/.test(path)) return json(navigation);
  if (path === '/v1/content/resolve') {
    return json({
      organization: { name: 'Seminsa', slug: 'seminsa' }, category: { id: 'cat-formas', name: label('Formas', 'Forms'), slug: 'formas' }, subcategory: { id: 'sub-formas', name: label('Formas', 'Forms'), slug: 'formas' },
      panel: { id: 'panel-formas', name: label('Formas', 'Forms'), description: null, icon: null, slug: 'formas', status: 'PUBLISHED' }, canonicalPath: '/seminsa/formas/formas/formas',
      revision: { id: 'rev-1', panelId: 'panel-formas', revisionNumber: 1, etag: '"1"', defaultLocale: 'es', fallbackLocales: ['en'], locale: { requested: null, resolved: 'es', fallbackChain: ['es', 'en'] }, document: {
        schemaVersion: 1, defaultLocale: 'es', fallbackLocales: ['en'], sections: [{ id: 's', order: 0, layout: { variant: 'grid', gap: 'md' }, components: [{ id: 'c', type: 'document_workspace', schemaVersion: 1, props: { typeKey: 'forma' }, bindings: {}, order: 0, layout: { desktop: { x: 0, y: 0, w: 12, h: 2 }, tablet: { x: 0, y: 0, w: 6, h: 2 }, mobile: { x: 0, y: 0, w: 12, h: 2 } } }] }],
      } },
    });
  }
  if (/\/document-types$/.test(path)) return json({ types: [type], channels: { email: 'available', whatsapp: 'not_configured' } });
  if (/\/document-clients$/.test(path)) return json(clients.map((name, index) => ({ id: `client-${index}`, name, email: null, phone: null })));
  if (/\/documents$/.test(path)) return json({ items: documents, nextCursor: null });
  if (/\/documents\/[^/]+\/events$/.test(path)) return json(events);
  if (/\/documents\/[^/]+$/.test(path)) return json(detail(path.split('/').pop()!));
  console.warn('[harness] unmocked', init?.method ?? 'GET', path);
  return json({ error: { code: 'NOT_FOUND', message: 'mock: not found' } }, 404);
};

// Land on the Seminsa organization route, like a real deep link.
if (window.location.pathname.startsWith('/dev/')) window.history.replaceState({}, '', new URLSearchParams(window.location.search).get('path') ?? '/seminsa');
await import('/src/main.tsx');
