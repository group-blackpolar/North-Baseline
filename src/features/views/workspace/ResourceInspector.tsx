import { useMemo, type ReactNode } from 'react';
import { ArrowSquareOut, Eye, FileText, Folder, FolderSimple, PencilSimple, Copy, Archive, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { getDraft, listRevisions, type PanelRevisionSummary } from '@/lib/northAdmin';
import { useResource } from '@/features/admin-center/hooks';
import { KeyValue } from '@/features/admin-center/ui';
import { listDatasets } from '@/features/admin-center/api';
import { extractDatasetRefs } from '@/features/queries/dependencies';
import { localName, type ViewResource } from './resources';
import { summarizeRevisions } from './useViewsWorkspace';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0"><h3 className="ui-label">{title}</h3>{children}</section>;
}

/**
 * Contextual inspector. Everything shown comes from CORECROW for the selected resource: the management tree (identity,
 * status, audience), the revisions endpoint (versions, authors, publication) and the draft document (components and the
 * datasets it is bound to). Failures are contextual — they never block the rest of the workspace.
 */
export function ResourceInspector({ organizationId, resource, userName, onClose, onEdit, onOpen, onDuplicate, onArchive, onRename, canEdit }: {
  organizationId: string;
  resource: ViewResource | null;
  userName: (userId: string | null) => string;
  onClose?: () => void;
  onEdit: (resource: ViewResource) => void;
  onOpen: (resource: ViewResource) => void;
  onDuplicate: (resource: ViewResource) => void;
  onArchive: (resource: ViewResource) => void;
  onRename: (resource: ViewResource) => void;
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const isPanel = resource?.kind === 'PANEL';
  const panelId = isPanel ? resource.id : '';
  const updatedAt = resource?.updatedAt ?? '';
  const revisions = useResource<PanelRevisionSummary[]>(() => (panelId ? listRevisions(organizationId, panelId) : Promise.resolve([])), [organizationId, panelId, updatedAt]);
  const draft = useResource(() => (panelId && (resource?.draftRevisionId || resource?.publishedRevisionId) ? getDraft(organizationId, panelId) : Promise.resolve(null)), [organizationId, panelId, updatedAt]);
  const datasets = useResource(() => (panelId ? listDatasets(organizationId) : Promise.resolve([])), [organizationId, panelId]);

  const info = useMemo(() => (revisions.data ? summarizeRevisions(revisions.data, resource?.publishedRevisionId ?? null) : null), [revisions.data, resource?.publishedRevisionId]);
  const refs = useMemo(() => extractDatasetRefs(draft.data?.document as never), [draft.data]);
  const components = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of draft.data?.document.sections ?? []) for (const component of section.components) counts.set(component.type, (counts.get(component.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [draft.data]);
  const sectionCount = draft.data?.document.sections.length ?? 0;
  const datasetName = (id: string) => { const found = datasets.data?.find((dataset) => dataset.id === id); return found ? { name: localName(found.name, locale), state: found.status === 'ARCHIVED' ? 'archived' as const : 'ok' as const } : { name: id, state: 'missing' as const }; };
  const uniqueDatasets = [...new Set(refs.map((ref) => ref.datasetId))];
  const date = (value: string | null | undefined) => (value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  if (!resource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-surface-active text-text-muted"><Folder className="size-5" weight="duotone" /></span>
        <p className="text-sm font-medium text-text">{t('adm2.views.inspector.empty')}</p>
        <p className="max-w-56 text-xs text-text-secondary">{t('adm2.views.inspector.emptyBody')}</p>
      </div>
    );
  }

  const locked = resource.resourceKind === 'SYSTEM';
  const archived = resource.status === 'ARCHIVED';
  const Glyph = resource.kind === 'PANEL' ? FileText : resource.kind === 'CATEGORY' ? Folder : FolderSimple;
  const loadError = (state: { status: string; error: string | null }) => state.status === 'error' ? <p role="alert" className="text-xs text-error">{state.error}</p> : state.status === 'forbidden' ? <p className="text-xs text-text-muted">{t('adm2.kpi.forbidden')}</p> : null;

  return (
    <div key={resource.id} className="np-fade-in flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-2.5 border-b border-border p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-active text-text-secondary"><Glyph className="size-5" weight="duotone" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-semibold text-text">{localName(resource.name, locale)}</h2>
          <p className="truncate font-mono text-[11px] text-text-muted">{resource.slug}</p>
        </div>
        {onClose ? <Button size="icon-sm" variant="ghost" aria-label={t('common.close')} onClick={onClose}><X /></Button> : null}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Section title={t('adm2.views.inspector.general')}>
          <dl>
            <KeyValue label={t('adm2.views.col.type')}>{t(`adm2.views.kind.${resource.kind}` as never)}</KeyValue>
            <KeyValue label={t('adm2.views.col.status')}><span className="inline-flex flex-wrap justify-end gap-1"><Status tone={resource.status === 'PUBLISHED' || resource.status === 'ACTIVE' ? 'active' : resource.status === 'ARCHIVED' ? 'neutral' : 'pending'}>{t(`adm2.views.status.${resource.status}` as never)}</Status>{resource.hasUnpublishedChanges ? <Status tone="pending">{t('adm2.views.status.unpublished')}</Status> : null}</span></KeyValue>
            {resource.kind !== 'CATEGORY' ? <KeyValue label={t('adm2.views.col.category')}>{localName(resource.categoryName, locale)}</KeyValue> : null}
            {resource.kind === 'PANEL' ? <KeyValue label={t('adm2.filters.subcategory')}>{localName(resource.subcategoryName, locale)}</KeyValue> : null}
            {resource.audienceType ? <KeyValue label={t('adm2.views.col.audience')}>{t(`adm2.views.audience.${resource.audienceType}` as never)}</KeyValue> : null}
            <KeyValue label={t('adm2.views.inspector.origin')}>{locked ? t('adm2.filters.origin.system') : t('adm2.filters.origin.content')}</KeyValue>
          </dl>
          {resource.description ? <p className="text-xs leading-relaxed text-text-secondary">{localName(resource.description, locale)}</p> : null}
        </Section>

        <Section title={t('adm2.views.inspector.metadata')}>
          <dl>
            <KeyValue label="ID" mono>{resource.id}</KeyValue>
            <KeyValue label={t('adm2.views.col.created')}>{date(resource.createdAt)}</KeyValue>
            <KeyValue label={t('adm2.views.col.updated')}>{date(resource.updatedAt)}</KeyValue>
            {isPanel ? <KeyValue label={t('adm2.views.col.updatedBy')}>{revisions.status === 'loading' ? '…' : info ? userName(info.latestBy) : '—'}</KeyValue> : null}
            {isPanel ? <KeyValue label={t('adm2.views.inspector.currentVersion')}>{revisions.status === 'loading' ? '…' : info ? `v${info.latestNumber}` : '—'}</KeyValue> : null}
            {!isPanel ? <KeyValue label={resource.kind === 'CATEGORY' ? t('adm2.views.kind.SUBCATEGORY') : t('adm2.views.kind.PANEL')}>{resource.childCount}</KeyValue> : null}
          </dl>
        </Section>

        {isPanel ? (
          <>
            <Section title={t('adm2.views.inspector.publication')}>
              {revisions.status === 'loading' ? <Skeleton className="h-16 w-full" /> : (
                <dl>
                  <KeyValue label={t('adm2.views.inspector.draftVersion')}>{info ? `v${info.latestNumber}` : '—'}</KeyValue>
                  <KeyValue label={t('adm2.views.inspector.publishedVersion')}>{info?.publishedNumber != null ? `v${info.publishedNumber}` : t('adm2.views.inspector.notPublished')}</KeyValue>
                  <KeyValue label={t('adm2.views.inspector.lastPublished')}>{date(info?.publishedAt)}</KeyValue>
                  <KeyValue label={t('adm2.views.inspector.revisions')}>{revisions.data?.length ?? '—'}</KeyValue>
                </dl>
              )}
              {loadError(revisions)}
              <p className="text-[11px] leading-snug text-text-muted">{t('adm2.views.inspector.publishNote')}</p>
            </Section>

            <Section title={t('adm2.views.inspector.dependencies')}>
              {draft.status === 'loading' || datasets.status === 'loading' ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <dl>
                    <KeyValue label={t('adm2.views.inspector.sections')}>{sectionCount}</KeyValue>
                    <KeyValue label={t('adm2.views.inspector.components')}>{components.reduce((sum, [, count]) => sum + count, 0)}</KeyValue>
                  </dl>
                  {components.length > 0 ? <ul className="flex flex-wrap gap-1">{components.map(([type, count]) => <li key={type} className="rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[11px] text-text-secondary">{type} × {count}</li>)}</ul> : null}
                  <h4 className="pt-1 text-[11px] font-medium text-text-secondary">{t('adm2.views.inspector.datasets')}</h4>
                  {uniqueDatasets.length === 0 ? <p className="text-xs text-text-muted">{t('adm2.views.inspector.noDatasets')}</p> : (
                    <ul className="space-y-1">
                      {uniqueDatasets.map((id) => { const dataset = datasetName(id); return (
                        <li key={id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs">
                          <span className="min-w-0 truncate">{dataset.name}</span>
                          {dataset.state === 'ok' ? <Status tone="active">OK</Status> : <Status tone="error">{dataset.state === 'missing' ? t('adm2.q.deps.missing') : t('adm2.q.deps.archivedDataset')}</Status>}
                        </li>
                      ); })}
                    </ul>
                  )}
                  {loadError(draft)}
                </>
              )}
            </Section>
          </>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-1.5 border-t border-border p-3">
        {isPanel ? (
          <>
            <Button size="sm" variant="accent" disabled={!canEdit || locked || archived} onClick={() => onEdit(resource)}><PencilSimple />{t('adm2.views.act.edit')}</Button>
            <Button size="sm" variant="secondary" disabled={resource.status !== 'PUBLISHED'} onClick={() => onOpen(resource)}><ArrowSquareOut />{t('adm2.views.act.open')}</Button>
            <Button size="sm" variant="secondary" disabled={!canEdit || locked || archived} onClick={() => onEdit(resource)}><Eye />{t('adm2.views.act.preview')}</Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" disabled={!canEdit || locked || archived} onClick={() => onRename(resource)}><PencilSimple />{t('adm2.views.act.rename')}</Button>
        <Button size="sm" variant="ghost" disabled={!canEdit || locked || archived} onClick={() => onDuplicate(resource)}><Copy />{t('adm2.views.act.duplicate')}</Button>
        <Button size="sm" variant="ghost" className="text-error hover:text-error" disabled={!canEdit || locked || archived} onClick={() => onArchive(resource)}><Archive />{t('adm2.views.act.archive')}</Button>
      </footer>
    </div>
  );
}
