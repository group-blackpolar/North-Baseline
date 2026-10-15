import { useEffect, useMemo, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getDraft, type PanelRevision } from '@/lib/northAdmin';
import { useViewsEditor } from '../ViewsEditorContext';
import { diffDocuments, hasDifferences } from './conflict';

/**
 * Someone else saved or published this view first. Nothing is overwritten silently: the dialog shows how the two versions
 * differ and offers (1) keeping yours over theirs, (2) taking theirs (your copy can be downloaded first) or (3) deciding later.
 */
export function ConflictDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { organizationId, selection, getDocument, reloadDraft, overwriteWithMine } = useViewsEditor();
  const panelId = selection.panelId;
  const [theirs, setTheirs] = useState<PanelRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'mine' | 'theirs' | null>(null);

  useEffect(() => {
    setTheirs(null); setError(null);
    if (!open || !panelId) return;
    let live = true;
    getDraft(organizationId, panelId).then((value) => { if (live) setTheirs(value); }).catch((reason) => { if (live) setError(reason instanceof ApiError ? reason.message : t('st.conflict.loadFailed')); });
    return () => { live = false; };
  }, [open, organizationId, panelId, t]);

  const mine = open ? getDocument() : null;
  const diff = useMemo(() => (mine && theirs ? diffDocuments(mine, theirs.document) : null), [mine, theirs]);

  const download = () => {
    if (!mine) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(mine, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `view-${panelId ?? 'draft'}-mine.json`; link.click();
    URL.revokeObjectURL(url);
  };
  const run = async (which: 'mine' | 'theirs') => {
    setBusy(which); setError(null);
    try {
      if (which === 'mine') { if (await overwriteWithMine()) onClose(); else setError(t('st.conflict.failed')); }
      else { await reloadDraft(); onClose(); }
    } finally { setBusy(null); }
  };
  const ids = (list: string[]) => (list.length ? list.join(', ') : '—');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }} title={t('st.conflict.title')} description={t('st.conflict.body')} size="md"
      footer={<>
        <Button variant="ghost" disabled={busy !== null} onClick={onClose}>{t('st.conflict.later')}</Button>
        <Button variant="outline" loading={busy === 'theirs'} disabled={busy !== null || !theirs} onClick={() => void run('theirs')}>{t('st.conflict.takeTheirs')}</Button>
        <Button variant="destructive" loading={busy === 'mine'} disabled={busy !== null || !theirs} onClick={() => void run('mine')}>{t('st.conflict.keepMine')}</Button>
      </>}>
      {!theirs && !error ? <p className="text-sm text-text-secondary" role="status">{t('st.conflict.loading')}</p> : null}
      {diff ? (
        <div className="space-y-2 text-xs" aria-live="polite">
          {!hasDifferences(diff) ? <p className="text-text-secondary">{t('st.conflict.same')}</p> : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-text-muted">{t('st.conflict.addedByOthers')}</dt><dd className="mono-data text-text">{ids(diff.addedByOthers)}</dd>
              <dt className="text-text-muted">{t('st.conflict.onlyMine')}</dt><dd className="mono-data text-text">{ids(diff.onlyMine)}</dd>
              <dt className="text-text-muted">{t('st.conflict.changed')}</dt><dd className="mono-data text-text">{ids(diff.changed)}</dd>
              <dt className="text-text-muted">{t('st.conflict.sections')}</dt><dd className="text-text">{diff.sectionsMine} / {diff.sectionsTheirs}</dd>
            </dl>
          )}
          <p className="text-text-muted">{t('st.conflict.warn')}</p>
          <Button size="sm" variant="ghost" onClick={download}><DownloadSimple aria-hidden="true" />{t('st.conflict.download')}</Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-error">{error}</p> : null}
    </Dialog>
  );
}
