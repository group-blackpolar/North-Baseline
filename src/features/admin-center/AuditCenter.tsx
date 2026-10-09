import { useMemo, useState } from 'react';
import { ArrowsClockwise, ClockCounterClockwise, ListBullets, MagnifyingGlass, Rows } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Status } from '@/components/ui/status';
import { listMembers, type Member } from '@/features/access-admin/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { listAuditEntries, type AuditEntry } from './api';
import { auditCategory, emptyAuditFilters, filterAudit, groupByDay, type AuditFilters } from './auditModel';
import { useResource } from './hooks';
import { KeyValue, Loading, Notice, SectionTabs, Shell, Unavailable, errorText, invalidateOrganization, selectClass, td, th } from './ui';

const PAGE = 50;

/**
 * Activity & Audit. CORECROW Audit is the single source of truth; this screen only reads it (`audit.read`) and
 * filters the pages already loaded. The trail has no per-event "outcome" field, so none is shown.
 */
export function AuditCenter({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const first = useResource(() => listAuditEntries(organizationId, { limit: PAGE }), [organizationId]);
  const members = useResource(() => listMembers(organizationId), [organizationId]);
  const [more, setMore] = useState<AuditEntry[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [view, setView] = useState<'table' | 'timeline'>('table');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const events = useMemo(() => [...(first.data ?? []), ...more], [first.data, more]);
  const byUser = useMemo(() => new Map((members.data ?? []).map((member: Member) => [member.userId, member])), [members.data]);
  const actorName = (id: string) => byUser.get(id)?.name?.trim() || byUser.get(id)?.email || id;
  const categories = useMemo(() => [...new Set(events.map((event) => auditCategory(event.action)))].sort(), [events]);
  const actors = useMemo(() => [...new Set(events.flatMap((event) => (event.actorId ? [event.actorId] : [])))], [events]);
  const visible = useMemo(() => filterAudit(events, filters, actorName), [events, filters, byUser]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = events.at(-1);
  const dirty = JSON.stringify(filters) !== JSON.stringify(emptyAuditFilters());
  const when = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' });
  const toggle = (key: 'categories' | 'actors', value: string) => setFilters((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));

  const loadMore = async () => {
    if (!last) return;
    setBusy(true); setError(null);
    try {
      const page = await listAuditEntries(organizationId, { limit: PAGE, before: last.createdAt });
      setMore((current) => [...current, ...page]);
      if (page.length < PAGE) setExhausted(true);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const refresh = () => { invalidateOrganization(organizationId); setMore([]); setExhausted(false); void first.reload(); void members.reload(); };

  const target = (event: AuditEntry) => (event.targetType ? `${event.targetType}${event.targetId ? ` · ${event.targetId}` : ''}` : '—');
  const actorCell = (event: AuditEntry) => (event.actorId ? actorName(event.actorId) : t('adm2.audit.system'));

  return (
    <Shell title={t('adm2.audit.title')} hint={t('adm2.audit.hint')}>
      {first.status === 'forbidden' ? (
        <Unavailable tone="forbidden" title={t('adm2.audit.forbidden')} body={t('adm2.audit.forbiddenBody')} />
      ) : (
        <DashboardCard
          title={t('adm2.audit.events')}
          description={t('adm2.audit.scope', { shown: visible.length, loaded: events.length })}
          actions={
            <div className="flex items-center gap-2">
              <SectionTabs label={t('adm2.audit.view')} value={view} onChange={setView} tabs={[{ id: 'table', label: t('adm2.audit.table'), icon: Rows }, { id: 'timeline', label: t('adm2.audit.timeline'), icon: ListBullets }]} />
              <Button size="sm" variant="ghost" onClick={refresh}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="relative min-w-48 flex-1 sm:max-w-xs">
              <span className="sr-only">{t('adm2.audit.search')}</span>
              <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
              <Input className="pl-7" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder={t('adm2.audit.search')} />
            </label>
            <label className="space-y-0.5"><span className="ui-label block">{t('adm2.audit.from')}</span><Input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
            <label className="space-y-0.5"><span className="ui-label block">{t('adm2.audit.to')}</span><Input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
            <label className="space-y-0.5">
              <span className="ui-label block">{t('adm2.audit.actor')}</span>
              <select className={cn(selectClass, 'w-44')} value="" onChange={(event) => { if (event.target.value) toggle('actors', event.target.value); }}>
                <option value="">{t('adm2.audit.anyActor')}</option>
                {actors.map((id) => <option key={id} value={id}>{actorName(id)}</option>)}
              </select>
            </label>
            {dirty ? <Button size="sm" variant="ghost" onClick={() => setFilters(emptyAuditFilters())}>{t('adm2.filters.clear')}</Button> : null}
          </div>
          {categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('adm2.audit.categories')}>
              {categories.map((category) => {
                const on = filters.categories.includes(category);
                return <button key={category} type="button" aria-pressed={on} onClick={() => toggle('categories', category)} className={cn('rounded-full border px-2.5 py-0.5 text-[11px] transition-colors duration-(--duration-fast) pointer-coarse:min-h-(--touch-min)', on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-secondary hover:bg-surface-hover')}>{category}</button>;
              })}
              {filters.actors.map((id) => <button key={id} type="button" onClick={() => toggle('actors', id)} className="rounded-full border border-accent bg-accent-soft px-2.5 py-0.5 text-[11px] text-accent" aria-label={t('adm2.filters.remove', { name: actorName(id) })}>{actorName(id)} ×</button>)}
            </div>
          ) : null}

          <Notice error={error ?? (first.data ? first.error : null)} />
          {first.status === 'loading' ? <Loading /> : first.status === 'error' && !first.data ? (
            <EmptyState icon={ClockCounterClockwise} title={t('state.loadError')} body={first.error ?? undefined} action={<Button size="sm" onClick={refresh}>{t('error.retry')}</Button>} />
          ) : events.length === 0 ? (
            <EmptyState icon={ClockCounterClockwise} title={t('adm.audit.empty')} />
          ) : visible.length === 0 ? (
            <EmptyState icon={MagnifyingGlass} title={t('adm2.audit.noMatches')} body={exhausted ? undefined : t('adm2.audit.noMatchesHint')} action={!exhausted ? <Button size="sm" variant="secondary" loading={busy} onClick={() => void loadMore()}>{t('adm.audit.more')}</Button> : undefined} />
          ) : view === 'table' ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-separate border-spacing-0">
                <thead><tr><th className={th}>{t('adm.col.when')}</th><th className={th}>{t('adm.col.action')}</th><th className={th}>{t('adm.col.actor')}</th><th className={th}>{t('adm.col.target')}</th><th className={th}>{t('adm2.audit.request')}</th></tr></thead>
                <tbody>
                  {visible.map((event) => (
                    <tr key={event.id} tabIndex={0} onClick={() => setSelected(event)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(event); } }} className="cursor-pointer outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover/60 focus-visible:bg-surface-hover">
                      <td className={cn(td, 'whitespace-nowrap')}>{when(event.createdAt)}</td>
                      <td className={cn(td, 'font-medium')}><span className="mr-1.5 rounded bg-surface-active px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">{auditCategory(event.action)}</span>{event.action}</td>
                      <td className={cn(td, 'max-w-48 truncate')}>{actorCell(event)}</td>
                      <td className={cn(td, 'max-w-64 truncate mono-data')}>{target(event)}</td>
                      <td className={cn(td, 'max-w-32 truncate mono-data text-text-muted')}>{event.requestId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {groupByDay(visible).map((group) => (
                <section key={group.day} aria-label={group.day}>
                  <h3 className="ui-label mb-2">{new Date(`${group.day}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: 'full' })}</h3>
                  <ol className="relative space-y-1 border-l border-border pl-4">
                    {group.items.map((event) => (
                      <li key={event.id} className="relative">
                        <span aria-hidden="true" className="absolute -left-[1.3rem] top-3 size-2 rounded-full bg-accent ring-4 ring-surface" />
                        <button type="button" onClick={() => setSelected(event)} className="np-press-flat flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
                          <span className="min-w-0"><span className="block truncate font-medium text-text">{event.action}</span><span className="block truncate text-text-muted">{actorCell(event)} · {target(event)}</span></span>
                          <time className="shrink-0 text-text-muted" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleTimeString(locale)}</time>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
          {first.data && !exhausted && first.data.length >= PAGE && events.length > 0 ? <Button size="sm" variant="ghost" loading={busy} onClick={() => void loadMore()}>{t('adm.audit.more')}</Button> : null}
        </DashboardCard>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} side="right" title={t('adm2.audit.details')} description={selected?.action}>
        {selected ? (
          <div className="space-y-4">
            <dl>
              <KeyValue label={t('adm.col.when')}>{when(selected.createdAt)}</KeyValue>
              <KeyValue label={t('adm.col.actor')}>{actorCell(selected)}</KeyValue>
              {selected.actorId ? <KeyValue label="ID" mono>{selected.actorId}</KeyValue> : null}
              <KeyValue label={t('adm2.audit.category')}><Status tone="info">{auditCategory(selected.action)}</Status></KeyValue>
              <KeyValue label={t('adm.col.target')} mono>{target(selected)}</KeyValue>
              <KeyValue label={t('adm2.audit.request')} mono>{selected.requestId ?? '—'}</KeyValue>
              <KeyValue label={t('adm2.audit.event')} mono>{selected.id}</KeyValue>
            </dl>
            <div>
              <h3 className="ui-label mb-1">{t('adm2.audit.context')}</h3>
              {selected.metadata && typeof selected.metadata === 'object' && Object.keys(selected.metadata as object).length > 0 ? (
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-hover/50 p-2.5 text-[11px] leading-relaxed text-text">{JSON.stringify(selected.metadata, null, 2)}</pre>
              ) : <p className="text-xs text-text-muted">{t('adm2.audit.noContext')}</p>}
            </div>
          </div>
        ) : null}
      </Sheet>
    </Shell>
  );
}
