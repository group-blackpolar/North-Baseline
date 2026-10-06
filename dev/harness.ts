/* Development-only: installs a mocked CORECROW API, then boots the real app. Not bundled in production. */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const user = {
  id: 'user-1', email: 'sam@blackpolar.org', name: 'Samuel Blanquicett', role: 'USER', emailVerified: true,
  passwordChangeRequired: false, termsAcceptedAt: '2026-09-16T00:00:00.000Z', termsVersion: '2026-09-16', createdAt: '2026-09-01T00:00:00.000Z',
};
const organizations = [
  { id: 'org-seminsa', name: 'Seminsa', slug: 'seminsa' },
  { id: 'org-shark', name: 'SHARK', slug: 'shark' },
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

const original = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  const path = url.pathname;
  if (!path.startsWith('/v1/')) return original(input, init);
  await new Promise((resolve) => setTimeout(resolve, 120));
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
if (window.location.pathname.startsWith('/dev/')) window.history.replaceState({}, '', '/seminsa');
await import('/src/main.tsx');
