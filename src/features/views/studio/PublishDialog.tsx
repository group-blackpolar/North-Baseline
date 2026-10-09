import { useEffect, useRef, useState } from 'react';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { publishDraft, readRevision, type PanelDocument } from '@/lib/northAdmin';
import { useViewsEditor } from '../ViewsEditorContext';
import { countKind, diffDocuments, type DocumentDiff } from './docDiff';
import { componentLabelKey } from './labels';
import { validateDraftOnServer, type DraftReport } from './studioApi';

type Phase = { name: 'working' } | { name: 'ready'; report: DraftReport; diff: DocumentDiff | null; first: boolean } | { name: 'error'; message: string };

const messageOf = (reason: unknown) => (reason instanceof ApiError || reason instanceof Error ? reason.message : 'Request failed');

/**
 * Publish gate: saves the draft, asks CORECROW to validate exactly that saved revision, shows the structural change
 * against the live version and only enables Publish when there are no blocking errors. The publish request carries the
 * validated revision's ETag, so a draft that changed in the meantime is refused by the server (no silent overwrite).
 */
export function PublishDialog({ open, onClose, onValidated }: { open: boolean; onClose: () => void; onValidated: (report: DraftReport) => void }) {
  const { t } = useI18n();
  const { organizationId, selection, activePanel, saveNow, getDocument, refreshTaxonomy, setEtag, etag } = useViewsEditor();
  const [phase, setPhase] = useState<Phase>({ name: 'working' });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef(etag);
  etagRef.current = etag;
  const panelId = selection.panelId;
  const publishedId = activePanel?.publishedRevisionId ?? null;

  useEffect(() => {
    if (!open || !panelId) return;
    let alive = true;
    setPhase({ name: 'working' }); setError(null);
    (async () => {
      try {
        if (!(await saveNow())) throw new Error(t('st.publish.saveFirst'));
        const report = await validateOrDegrade(panelId);
        let diff: DocumentDiff | null = null;
        if (publishedId) {
          const live = await readRevision(organizationId, panelId, publishedId);
          diff = diffDocuments(live.document as PanelDocument, getDocument());
        }
        if (!alive) return;
        onValidated(report);
        setPhase({ name: 'ready', report, diff, first: !publishedId });
      } catch (reason) {
        if (alive) setPhase({ name: 'error', message: messageOf(reason) });
      }
    })();
    return () => { alive = false; };
    // Re-run only when the dialog opens for a panel; the callbacks are stable by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panelId]);

  // An older CORECROW without the validation route (rolling release) must not block publishing: the server still runs the
  // full schema/reference validation inside the publish transaction. The gap is shown as a warning, never hidden.
  const validateOrDegrade = async (id: string): Promise<DraftReport> => {
    try {
      return await validateDraftOnServer(organizationId, id);
    } catch (reason) {
      if (!(reason instanceof ApiError) || (reason.status !== 404 && reason.status !== 405)) throw reason;
      return { revisionId: '', revisionNumber: 0, etag: etagRef.current, checkedAt: new Date().toISOString(), valid: true, dependencies: [], issues: [{ severity: 'warning', code: 'VALIDATION_UNAVAILABLE', message: t('st.publish.unavailable') }] };
    }
  };

  const publish = async () => {
    if (phase.name !== 'ready' || !panelId) return;
    setPublishing(true); setError(null);
    try {
      const published = await publishDraft(organizationId, panelId, phase.report.etag);
      setEtag(published.etag);
      await refreshTaxonomy();
      onClose();
    } catch (reason) {
      setError(reason instanceof ApiError && (reason.status === 409 || reason.status === 412) ? t('st.publish.conflict') : messageOf(reason));
    } finally { setPublishing(false); }
  };

  const ready = phase.name === 'ready' ? phase : null;
  const errors = ready?.report.issues.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = ready?.report.issues.filter((issue) => issue.severity === 'warning') ?? [];
  const doc = getDocument();
  const typeOf = (componentId?: string) => {
    const component = componentId ? doc?.sections.flatMap((section) => section.components).find((item) => item.id === componentId) : null;
    return component ? t(componentLabelKey(component.type)) : null;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !publishing) onClose(); }}
      title={t('st.publish.title')}
      description={t('st.publish.description')}
      size="md"
      footer={<>
        <Button variant="ghost" disabled={publishing} onClick={onClose}>{t('access.cancel')}</Button>
        <Button variant="accent" loading={publishing} disabled={!ready || errors.length > 0} onClick={() => void publish()}>{ready?.first ? t('st.publish.confirmFirst') : t('st.publish.confirm')}</Button>
      </>}
    >
      <div className="space-y-4" aria-live="polite">
        {phase.name === 'working' ? <div className="space-y-2" aria-busy="true"><Skeleton className="h-5 w-48" /><Skeleton className="h-16 w-full" /><span className="sr-only">{t('st.publish.checking')}</span></div> : null}
        {phase.name === 'error' ? <p role="alert" className="flex items-start gap-2 text-sm text-error"><XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{phase.message}</p> : null}
        {ready ? (
          <>
            <p className={`flex items-center gap-2 text-sm font-medium ${errors.length ? 'text-error' : 'text-success'}`}>
              {errors.length ? <XCircle className="size-5" aria-hidden="true" /> : <CheckCircle className="size-5" aria-hidden="true" />}
              {errors.length ? t('st.publish.blocked', { n: errors.length }) : warnings.length ? t('st.publish.okWarnings', { n: warnings.length }) : t('st.publish.ok')}
            </p>
            {ready.report.issues.length > 0 ? (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {ready.report.issues.map((issue, index) => (
                  <li key={index} className={`flex items-start gap-2 text-xs leading-5 ${issue.severity === 'error' ? 'text-error' : 'text-warning'}`}>
                    {issue.severity === 'error' ? <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : <WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
                    <span><span className="font-medium">{typeOf(issue.componentId) ?? t('st.publish.document')}</span> — {issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <section aria-labelledby="pub-changes">
              <h3 id="pub-changes" className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t('st.publish.changes')}</h3>
              {ready.first ? <p className="text-xs text-text-secondary">{t('st.publish.firstPublication')}</p> : ready.diff?.identical ? <p className="text-xs text-text-secondary">{t('st.publish.noChanges')}</p> : ready.diff ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {([['added', countKind(ready.diff, 'added')], ['removed', countKind(ready.diff, 'removed')], ['moved', countKind(ready.diff, 'moved')], ['configured', countKind(ready.diff, 'configured')], ['rebound', countKind(ready.diff, 'rebound')]] as const).map(([kind, n]) => (
                    <div key={kind} className="flex justify-between border-b border-border/60 py-1"><dt className="text-text-muted">{t(`st.diff.${kind}` as 'st.diff.added')}</dt><dd className="font-mono text-text">{n}</dd></div>
                  ))}
                  <div className="flex justify-between border-b border-border/60 py-1"><dt className="text-text-muted">{t('st.diff.sections')}</dt><dd className="font-mono text-text">+{ready.diff.sectionsAdded} / −{ready.diff.sectionsRemoved}</dd></div>
                </dl>
              ) : null}
            </section>
            {ready.report.dependencies.length > 0 ? <p className="text-[11px] text-text-muted">{t('st.publish.dependencies', { n: ready.report.dependencies.filter((d) => d.kind === 'binding').length })}</p> : null}
          </>
        ) : null}
        {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
      </div>
    </Dialog>
  );
}
