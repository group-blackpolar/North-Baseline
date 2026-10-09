import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { LayoutProvider } from '@/context/LayoutContext';
import { OrganizationProvider } from '@/context/OrganizationContext';
import { I18nProvider } from '@/lib/i18n';

const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') ?? 'normal';
document.documentElement.dataset.theme = params.get('theme') ?? 'light';

// A scripted stand-in for CORECROW's /v1/ai/* contract (dev harness only; the product never mocks).
const frame = (id: number, type: string, data: unknown) => `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const requests: string[] = [];
(window as unknown as { __requests: string[] }).__requests = requests;
let runs = 0;
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname !== '/v1/organizations' && !url.pathname.startsWith('/v1/ai/')) return realFetch(input, init);
  requests.push(`${init?.method ?? 'GET'} ${url.pathname}${url.search}`);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.pathname === '/v1/organizations') return json([{ id: 'org-a', name: 'Acme Test', slug: 'acme-test', status: 'ACTIVE' }]);
  if (!url.pathname.startsWith('/v1/ai/')) return realFetch(input, init);
  if (url.pathname === '/v1/ai/conversations') return init?.method === 'POST' ? json({ id: 'c1', title: null, updatedAt: new Date().toISOString() }, 201) : json([]);
  if (url.pathname === '/v1/ai/runs' && init?.method === 'POST') {
    if (scenario === 'ratelimit') return json({ error: { code: 'AI_PROVIDER_RATE_LIMITED' } }, 503);
    runs++; return json({ runId: `r${runs}` }, 202);
  }
  if (url.pathname.endsWith('/cancel')) return json({}, 200);
  if (url.pathname.endsWith('/events')) {
    const after = Number(url.searchParams.get('after') ?? 0);
    const script: Array<[number, string, unknown, number]> = [
      [1, 'run.started', {}, 150],
      [2, 'tool.proposed', { toolCallId: 't1', name: 'user.permissions' }, 200],
      [3, 'tool.started', { toolCallId: 't1', name: 'user.permissions' }, 200],
      [4, 'tool.completed', { toolCallId: 't1', name: 'user.permissions' }, 300],
      ...'Tu rol es **MEMBER**. Puedes:\n- ver documentos\n- descargar PDF\n\nPara crear documentos pídeselo a un admin.'.split(/(?<=\s)/).map((part, i): [number, string, unknown, number] => [5 + i, 'message.delta', { text: part }, scenario === 'stopme' ? 400 : 40]),
    ];
    const last = script.at(-1)![0];
    script.push([last + 1, 'message.completed', { text: 'Tu rol es **MEMBER**. Puedes:\n- ver documentos\n- descargar PDF\n\nPara crear documentos pídeselo a un admin.' }, 50], [last + 2, 'run.completed', {}, 20]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const [id, type, data, delay] of script) {
          if (id <= after) continue;
          await sleep(delay);
          if (init?.signal?.aborted) { controller.close(); return; }
          controller.enqueue(encoder.encode(frame(id, type, data)));
          if (scenario === 'drop' && after === 0 && id === 6) { controller.close(); return; } // connection lost mid-answer
        }
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }
  return json({}, 404);
};

function Harness() {
  const [org, setOrg] = useState('org-a');
  return (
    <div className="north-app-shell flex flex-col gap-3 bg-background p-4 text-text">
      <div className="flex items-center gap-2"><Button size="sm" onClick={() => setOrg(org === 'org-a' ? 'org-b' : 'org-a')}>Switch tenant (now {org})</Button></div>
      <div className="h-[560px] w-[24rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-overlay">
        <AssistantPanel key={org} organizationId={org} autoFocus={false} />
      </div>
    </div>
  );
}

// ?shell=1 mounts the real layout bar (with the raven launcher) inside the real organization provider.
function Shell() {
  return (
    <OrganizationProvider user={{ id: 'u1' }}>
      <LayoutProvider>
        <div className="north-app-shell flex h-[520px] bg-background text-text">
          <div className="flex-1 p-6 text-sm text-text-muted">Workspace content</div>
          <LayoutSwitcher />
        </div>
      </LayoutProvider>
    </OrganizationProvider>
  );
}

createRoot(document.getElementById('root')!).render(<I18nProvider><TooltipProvider>{params.has('shell') ? <Shell /> : <Harness />}</TooltipProvider></I18nProvider>);
