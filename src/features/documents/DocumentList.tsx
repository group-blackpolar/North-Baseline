import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FilePlus2, FileText, Pencil, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { fetchPdf, listDocuments, type DocumentStatus, type DocumentSummary, type DocumentType } from './api';
import { formatMoney } from './money';
import { ErrorNote, StatusBadge, errorText, formatDate, saveBlob, selectClass } from './shared';

const STATUSES: DocumentStatus[] = ['DRAFT', 'READY', 'SENT', 'COMPLETED', 'CANCELLED'];

export function DocumentList({ organizationId, type, can, refreshKey, onNew, onOpen, onEdit, onSend }: {
  organizationId: string;
  type: DocumentType;
  can: { create: boolean; update: boolean; download: boolean; send: boolean };
  refreshKey: number;
  onNew: () => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onSend: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<DocumentSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (append: string | null) => {
    const request = ++requestRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const page = await listDocuments(organizationId, type.id, { q, status, from, to, cursor: append ?? undefined });
      if (request !== requestRef.current) return;
      setRows((current) => (append ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError(null);
    } catch (reason) {
      if (request === requestRef.current) setError(errorText(reason));
    } finally {
      if (request === requestRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [organizationId, type.id, q, status, from, to]);

  // Filters re-query after a short pause so typing never fires one request per key.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(null), q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshKey]);

  const download = async (row: DocumentSummary) => {
    setBusy(row.id); setError(null);
    try { saveBlob(await fetchPdf(organizationId, row.id, locale === 'en' ? 'en' : 'es'), `${row.reference}.pdf`); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(null); }
  };

  const filtered = Boolean(q || status || from || to);
  const th = 'border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted';
  const td = 'border-b border-border/60 px-3 py-2.5 text-sm text-text';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('documents.search')} aria-label={t('documents.search')} className="pl-8" />
        </div>
        <select aria-label={t('documents.col.status')} className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as DocumentStatus | '')}>
          <option value="">{t('documents.allStatuses')}</option>
          {STATUSES.map((value) => <option key={value} value={value}>{t(`documents.status.${value}` as never)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">{t('documents.from')}<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-36" /></label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">{t('documents.to')}<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-36" /></label>
        {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setStatus(''); setFrom(''); setTo(''); }}>{t('analytics.clearFilters')}</Button>}
        <div className="ml-auto"><Button variant="accent" onClick={onNew} disabled={!can.create} title={can.create ? undefined : t('documents.noPermission')}><FilePlus2 className="size-4" />{t('documents.new')}</Button></div>
      </div>

      <ErrorNote message={error} />

      {loading && rows.length === 0 ? (
        <div aria-busy="true" className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={filtered ? t('documents.emptyFiltered') : t('documents.empty')} body={filtered ? undefined : t('documents.emptyHint')} className="mx-auto max-w-md"
          action={!filtered && can.create ? <Button variant="accent" onClick={onNew}><FilePlus2 className="size-4" />{t('documents.new')}</Button> : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-full border-separate border-spacing-0">
            <thead><tr>
              <th className={th}>{t('documents.col.reference')}</th><th className={th}>{t('documents.col.client')}</th><th className={th}>{t('documents.col.date')}</th>
              <th className={cn(th, 'text-right')}>{t('documents.col.total')}</th><th className={th}>{t('documents.col.status')}</th><th className={th}><span className="sr-only">{t('documents.col.actions')}</span></th>
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="group cursor-pointer transition-colors duration-100 hover:bg-surface-hover/60" onClick={() => onOpen(row.id)}>
                  <td className={cn(td, 'font-medium')}><button type="button" className="mono-data text-accent hover:underline focus-visible:underline" onClick={(event) => { event.stopPropagation(); onOpen(row.id); }}>{row.reference}</button></td>
                  <td className={td}>{row.clientName}</td>
                  <td className={cn(td, 'text-text-secondary')}>{formatDate(row.date, locale)}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{formatMoney(row.total, row.currency, locale)}</td>
                  <td className={td}><StatusBadge status={row.status} label={t(`documents.status.${row.status}` as never)} /></td>
                  <td className={cn(td, 'text-right')} onClick={(event) => event.stopPropagation()}>
                    <span className="inline-flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {can.update && (row.status === 'DRAFT' || row.status === 'READY') && <Button size="icon-sm" variant="ghost" aria-label={t('documents.edit')} title={t('documents.edit')} onClick={() => onEdit(row.id)}><Pencil className="size-3.5" /></Button>}
                      {can.download && <Button size="icon-sm" variant="ghost" aria-label={t('documents.pdf')} title={t('documents.pdf')} disabled={busy === row.id} onClick={() => void download(row)}><Download className="size-3.5" /></Button>}
                      {can.send && row.status !== 'DRAFT' && row.status !== 'CANCELLED' && <Button size="icon-sm" variant="ghost" aria-label={t('documents.send')} title={t('documents.send')} onClick={() => onSend(row.id)}><Send className="size-3.5" /></Button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cursor && <div className="flex justify-center border-t border-border p-2"><Button variant="ghost" size="sm" disabled={loadingMore} onClick={() => void load(cursor)}>{loadingMore ? t('analytics.loading') : t('documents.loadMore')}</Button></div>}
        </div>
      )}
    </div>
  );
}
