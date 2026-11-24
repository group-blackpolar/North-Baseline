import { useState } from 'react';
import { Archive, ArrowCounterClockwise, Copy, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useResource } from '@/features/admin-center/hooks';
import { useI18n } from '@/lib/i18n';
import { categoriesApi, evaluationsApi } from './api';
import { CategoryAdmin } from './AuthoringExtras';
import { EvaluationEditor } from './EvaluationEditor';
import type { EvaluationKind, EvaluationRow } from './model';
import { ClipboardText } from '@phosphor-icons/react';

const field = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent/40';

/** List of the organization's evaluations (exams or forms) and the entry to the editor. Permissions only decide what is offered. */
export function BuilderPanel({ organizationId, kind, can }: { organizationId: string; kind?: EvaluationKind; can: { create: boolean; update: boolean; delete: boolean; publish: boolean; manage: boolean } }) {
  const { t } = useI18n();
  const rows = useResource(() => evaluationsApi.list(organizationId), [organizationId]);
  const categories = useResource(() => categoriesApi.list(organizationId, true), [organizationId]);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [newKind, setNewKind] = useState<EvaluationKind>(kind ?? 'EXAM');
  const [removing, setRemoving] = useState<EvaluationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (work: () => Promise<unknown>) => { setBusy(true); setError(null); try { await work(); await Promise.all([rows.reload(), categories.reload()]); } catch (reason) { setError(reason instanceof Error ? reason.message : 'error'); } finally { setBusy(false); } };
  const create = () => act(async () => { const created = await evaluationsApi.create(organizationId, { kind: kind ?? newKind, title: title.trim() }); if (creatingIn) await evaluationsApi.setCategory(organizationId, created.id, creatingIn); setCreating(false); setTitle(''); setEditing(created.id); });

  if (editing) return <EvaluationEditor organizationId={organizationId} evaluationId={editing} can={can} onBack={() => { setEditing(null); void rows.reload(); }} />;
  const list = (rows.data ?? []).filter((row) => !kind || row.kind === kind);
  // Evaluations live inside their category (administrable, ordered); the ones without one go last.
  const known = new Set((categories.data?.categories ?? []).map((category) => category.id));
  const groups = [
    ...(categories.data?.categories ?? []).map((category) => ({ id: category.id as string | null, name: category.name, color: category.color, rows: list.filter((row) => row.categoryId === category.id) })),
    ...(list.some((row) => !row.categoryId || !known.has(row.categoryId)) ? [{ id: null as string | null, name: t('st.cat.uncategorized'), color: '#64748b', rows: list.filter((row) => !row.categoryId || !known.has(row.categoryId)) }] : []),
  ].filter((group) => group.id === null || !(categories.data?.categories.find((category) => category.id === group.id)?.status === 'ARCHIVED' && group.rows.length === 0));

  return (
    <section aria-label={t('ev.builder.title')} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">{t('ev.builder.listHint')}</p>
        {can.create ? <Button variant="accent" onClick={() => { setCreatingIn(null); setCreating(true); }}><Plus className="size-4" aria-hidden />{t('ev.builder.create')}</Button> : null}
      </div>
      {kind !== 'FORM' ? <CategoryAdmin organizationId={organizationId} canManage={can.manage} /> : null}
      {error ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</p> : null}
      {rows.status === 'loading' ? <Skeleton className="h-28 w-full rounded-xl" />
        : list.length === 0 ? <EmptyState icon={ClipboardText} title={t('ev.builder.none')} body={t('ev.builder.noneHint')} />
        : <div className="space-y-5">{groups.map((group) => (
          <section key={group.id ?? 'none'} aria-label={group.name} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-text"><span aria-hidden className="size-3 rounded-full" style={{ background: group.color }} />{group.name}<span className="text-sm font-normal tabular-nums text-text-muted">· {group.rows.length}</span></h3>
              {can.create && group.id ? <Button size="sm" variant="ghost" onClick={() => { setCreatingIn(group.id); setCreating(true); }}><Plus className="size-4" aria-hidden />{t('st.builder.newInCategory')}</Button> : null}
            </div>
            {group.rows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-3 text-sm text-text-muted">{t('st.builder.categoryEmpty')}</p>
              : <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <button type="button" className="min-w-0 space-y-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40" onClick={() => setEditing(row.id)}>
                  <span className="block font-display text-base font-semibold text-text [overflow-wrap:anywhere]">{row.title}</span>
                  <span className="block text-xs text-text-muted">{t('ev.builder.rowMeta', { questions: row.questionCount, version: row.currentVersion ?? 0 })}</span>
                </button>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Status tone={row.status === 'PUBLISHED' ? 'active' : row.status === 'ARCHIVED' ? 'neutral' : 'pending'}>{t(`ev.status.${row.status}`)}</Status>
                  {row.hasUnpublishedChanges && row.status !== 'ARCHIVED' ? <Status tone="info">{t('ev.builder.unpublished')}</Status> : null}
                  <span className="flex-1" />
                  {can.create && can.update ? <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.duplicate')} disabled={busy} onClick={() => void act(() => evaluationsApi.duplicate(organizationId, row.id))}><Copy className="size-4" aria-hidden /></Button> : null}
                  {can.manage ? <Button size="icon-sm" variant="ghost" aria-label={row.status === 'ARCHIVED' ? t('ev.builder.unarchive') : t('ev.builder.archive')} disabled={busy} onClick={() => void act(() => evaluationsApi.archive(organizationId, row.id, row.status !== 'ARCHIVED'))}>{row.status === 'ARCHIVED' ? <ArrowCounterClockwise className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}</Button> : null}
                  {can.delete && row.currentVersion === null ? <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.delete')} disabled={busy} onClick={() => setRemoving(row)}><Trash className="size-4" aria-hidden /></Button> : null}
                </div>
              </li>))}</ul>}
          </section>))}</div>}

      <Dialog open={creating} onOpenChange={(open) => { if (!open && !busy) setCreating(false); }} title={t('ev.builder.create')} size="sm"
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setCreating(false)}>{t('access.cancel')}</Button><Button variant="accent" loading={busy} disabled={!title.trim()} onClick={() => void create()}>{t('ev.builder.createConfirm')}</Button></>}>
        <div className="space-y-3">
          <label className="block space-y-1"><span className="ui-label">{t('ev.settings.title')}</span><input className={field} value={title} maxLength={200} autoFocus onChange={(event) => setTitle(event.target.value)} /></label>
          {!kind ? <label className="block space-y-1"><span className="ui-label">{t('ev.builder.kind')}</span><select className={field} value={newKind} onChange={(event) => setNewKind(event.target.value as EvaluationKind)}><option value="EXAM">{t('ev.kind.EXAM')}</option><option value="FORM">{t('ev.kind.FORM')}</option></select></label> : null}
        </div>
      </Dialog>
      <ConfirmDialog open={removing !== null} busy={busy} destructive title={t('ev.builder.deleteTitle')} description={t('ev.builder.deleteBody', { title: removing?.title ?? '' })} confirmLabel={t('ev.builder.delete')}
        onCancel={() => setRemoving(null)} onConfirm={() => void act(async () => { await evaluationsApi.remove(organizationId, removing!.id); setRemoving(null); })} />
    </section>
  );
}
