import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/lib/i18n';
import { ViewsEditorProvider, useViewsEditor } from '@/features/views/ViewsEditorContext';
import { StudioEditor } from '@/features/views/studio/StudioEditor';
import type { ManagementCategory } from '@/lib/northAdmin';

// A scripted stand-in for the CORECROW draft / binding / dataset contracts (dev harness only; the product never mocks).
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') ?? 'light';
const ORG = 'org-a';
const PANEL = 'p1';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const lab = (es: string, en = es) => ({ es, en });
const state = {
  rev: 0,
  doc: { schemaVersion: 1, defaultLocale: 'es', fallbackLocales: ['en'], sections: [] as unknown[] } as Record<string, unknown>,
  published: null as Record<string, unknown> | null,
  publishedId: null as string | null,
  bindings: [] as Array<Record<string, unknown>>,
  calls: [] as string[],
  conflictNext: params.has('conflict'),
};
(window as unknown as { __studio: typeof state }).__studio = state;
const etag = () => `"rev-${state.rev}"`;
const revision = () => ({ id: `rev-${state.rev}`, panelId: PANEL, revisionNumber: state.rev, etag: etag(), defaultLocale: 'es', fallbackLocales: ['en'], message: null, publishAt: null, unpublishAt: null, createdBy: 'u1', createdAt: new Date().toISOString(), document: state.doc });
const fields = [
  { id: 'f-country', datasetId: 'd1', key: 'country', displayName: lab('País', 'Country'), canonicalType: 'TEXT', nullable: false, status: 'ACTIVE' },
  { id: 'f-port', datasetId: 'd1', key: 'port', displayName: lab('Puerto', 'Port'), canonicalType: 'TEXT', nullable: false, status: 'ACTIVE' },
  { id: 'f-teu', datasetId: 'd1', key: 'teu', displayName: lab('TEU', 'TEU'), canonicalType: 'INTEGER', nullable: false, status: 'ACTIVE' },
  { id: 'f-amount', datasetId: 'd1', key: 'amount', displayName: lab('Monto', 'Amount'), canonicalType: 'DECIMAL', nullable: false, status: 'ACTIVE' },
];
const data: Array<Array<string | number>> = [['China', 'Colón', 120, 4000.5], ['China', 'Balboa', 80, 2500], ['USA', 'Colón', 60, 1800.25], ['Panamá', 'Balboa', 30, 900], ['Brasil', 'Colón', 45, 1300]];
const queryRows = (query: Record<string, unknown>) => {
  if (query.mode === 'ROWS') {
    const ids = query.fields as string[];
    const idx = (id: string) => fields.findIndex((f) => f.id === id);
    return { columns: ids.map((id) => ({ key: id, fieldId: id, type: fields[idx(id)]!.canonicalType })), rows: data.map((r) => Object.fromEntries(ids.map((id) => [id, r[idx(id)]]))) };
  }
  const group = (query.groupBy as string[] | undefined)?.[0];
  const measures = query.measures as Array<{ alias: string; operation: string; fieldId?: string }>;
  const gi = group ? fields.findIndex((f) => f.id === group) : -1;
  const keys = gi >= 0 ? [...new Set(data.map((r) => String(r[gi])))] : ['*'];
  const rows = keys.map((k) => {
    const subset = gi >= 0 ? data.filter((r) => String(r[gi]) === k) : data;
    const out: Record<string, unknown> = gi >= 0 ? { [group!]: k } : {};
    for (const m of measures) {
      const fi = m.fieldId ? fields.findIndex((f) => f.id === m.fieldId) : -1;
      const vals = subset.map((r) => Number(r[fi]));
      const sum = vals.reduce((a, b) => a + b, 0);
      out[m.alias] = m.operation === 'SUM' ? sum : m.operation === 'AVG' ? sum / vals.length : m.operation === 'MIN' ? Math.min(...vals) : m.operation === 'MAX' ? Math.max(...vals) : subset.length;
    }
    return out;
  });
  return { columns: [...(gi >= 0 ? [{ key: group!, fieldId: group, type: 'TEXT' }] : []), ...measures.map((m) => ({ key: m.alias, type: 'DECIMAL' }))], rows };
};
const validate = () => {
  const issues: Array<Record<string, unknown>> = [];
  const sections = (state.doc.sections ?? []) as Array<{ components: Array<{ id: string; type: string; bindings: Record<string, unknown> }> }>;
  let count = 0;
  for (const s of sections) for (const c of s.components) {
    count++;
    if (['bar_chart', 'line_chart', 'donut_chart'].includes(c.type) && Object.keys(c.bindings).length === 0) issues.push({ severity: 'error', code: 'BINDING_REQUIRED', message: 'A chart needs a data binding to render anything', componentId: c.id });
  }
  if (!count) issues.push({ severity: 'warning', code: 'EMPTY_VIEW', message: 'The draft has no components' });
  return { revisionId: `rev-${state.rev}`, revisionNumber: Math.max(1, state.rev), etag: etag(), checkedAt: new Date().toISOString(), valid: !issues.some((i) => i.severity === 'error'), issues, dependencies: [] };
};

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  const path = url.pathname;
  if (!path.startsWith('/v1/')) return realFetch(input, init);
  const method = init?.method ?? 'GET';
  state.calls.push(`${method} ${path}`);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const base = `/v1/organizations/${ORG}`;
  if (path === `${base}/panels/${PANEL}/draft` && method === 'GET') return state.rev === 0 ? json({ error: { code: 'NOT_FOUND', message: 'Draft not found' } }, 404) : json(revision());
  if (path === `${base}/panels/${PANEL}/draft` && method === 'PATCH') {
    const sent = (init?.headers as Record<string, string> | undefined)?.['If-Match'];
    if (state.conflictNext) { state.conflictNext = false; return json({ error: { code: 'REVISION_CONFLICT', message: 'Draft changed since it was loaded' } }, 409); }
    if (state.rev > 0 && sent !== etag()) return json({ error: { code: 'REVISION_CONFLICT', message: 'Draft changed since it was loaded' } }, 409);
    state.doc = JSON.parse(String(init?.body)).document;
    state.rev += 1;
    return json(revision());
  }
  if (path === `${base}/panels/${PANEL}/draft/validate`) return json(validate());
  if (path === `${base}/panels/${PANEL}/publish`) { state.published = state.doc; state.publishedId = `rev-${state.rev}`; return json(revision()); }
  if (path === `${base}/panels/${PANEL}/revisions`) return json([]);
  if (path.startsWith(`${base}/panels/${PANEL}/revisions/`)) return json({ ...revision(), id: state.publishedId, document: state.published });
  if (path === `${base}/panels/${PANEL}/analytics-bindings` && method === 'GET') return json(state.bindings);
  if (path === `${base}/panels/${PANEL}/analytics-bindings` && method === 'POST') {
    const body = JSON.parse(String(init?.body));
    const created = { id: `b-${state.bindings.length + 1}`, panelId: PANEL, ...body, allowedFilters: body.allowedFilters ?? [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.bindings.push(created);
    return json(created, 201);
  }
  if (path === `${base}/datasets`) return json([{ id: 'd1', organizationId: ORG, name: lab('Contenedores', 'Containers'), slug: 'contenedores', status: 'ACTIVE', createdBy: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]);
  if (path === `${base}/datasets/d1/fields`) return json(fields);
  if (path === `${base}/datasets/d1/query`) {
    const q = JSON.parse(String(init?.body));
    const r = queryRows(q);
    return json({ mode: q.mode, datasetId: 'd1', activeRevisionId: 'ar', schemaVersionId: 'sv', ...r, rowCount: r.rows.length, executedAt: new Date().toISOString() });
  }
  console.warn('[studio harness] unmocked', method, path);
  return json({ error: { code: 'NOT_FOUND', message: 'mock: not found' } }, 404);
};

const taxonomy = [{
  id: 'c1', organizationId: ORG, resourceKind: 'CONTENT', categoryClass: 'CUSTOM', name: lab('Operaciones'), slug: 'ops', status: 'ACTIVE',
  subcategories: [{ id: 's1', organizationId: ORG, categoryId: 'c1', resourceKind: 'CONTENT', name: lab('Resumen'), slug: 'resumen', status: 'ACTIVE',
    panels: [{ id: PANEL, organizationId: ORG, subcategoryId: 's1', resourceKind: 'CONTENT', name: lab('Tablero de carga', 'Cargo board'), slug: 'tablero', status: 'DRAFT', audienceType: 'ALL_MEMBERS', publishedRevisionId: null, draftRevisionId: null }] }],
}] as unknown as ManagementCategory[];

function Select() {
  const { selectPanel, selection } = useViewsEditor();
  useEffect(() => { selectPanel('c1', 's1', PANEL); }, [selectPanel]);
  return selection.panelId ? null : <p className="p-4 text-sm">Selecting…</p>;
}

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="north-app-shell flex h-dvh flex-col bg-background text-text">
      <ViewsEditorProvider organizationId={ORG} taxonomy={taxonomy} loading={false} refreshTaxonomy={async () => true}>
        <Select />
        {open ? <StudioEditor onExit={() => setOpen(false)} /> : <button className="m-4 rounded border border-border px-3 py-1 text-sm" onClick={() => setOpen(true)}>Reopen</button>}
      </ViewsEditorProvider>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<I18nProvider><TooltipProvider><Harness /></TooltipProvider></I18nProvider>);
