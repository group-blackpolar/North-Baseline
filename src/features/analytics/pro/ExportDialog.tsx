import { CheckCircle, DownloadSimple, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { EXPORT_MAX_ROWS, EXPORT_MIN_ROWS, type ExportRequest, type ExportResult } from '../panelBindingQuery';

type Status = 'idle' | 'working' | 'done' | 'error';

/** The count CORECROW will accept for this many matching rows, or null when the selection is too small to export. */
export const exportLimits = (total: number) => (total < EXPORT_MIN_ROWS ? null : { min: EXPORT_MIN_ROWS, max: Math.min(total, EXPORT_MAX_ROWS) });

function download(result: ExportResult) {
  const bytes = Uint8Array.from(atob(result.contentBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
  const link = Object.assign(document.createElement('a'), { href: url, download: result.filename });
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * One export dialog for every exportable component: format (CSV / Excel) and row count are independent choices, the total
 * of matching rows is shown first, and the range follows the real total. CORECROW re-validates all of it.
 */
export function ExportDialog({ open, onClose, total, run, request }: { open: boolean; onClose: () => void; total: number; run: (request: ExportRequest, signal: AbortSignal) => Promise<ExportResult>; request: Omit<ExportRequest, 'format' | 'count'> }) {
  const { t, locale } = useI18n();
  const limits = exportLimits(total);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [count, setCount] = useState(limits?.max ?? 0);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  const numbers = new Intl.NumberFormat(locale);
  useEffect(() => { if (open) { setStatus('idle'); setMessage(''); setCount(exportLimits(total)?.max ?? 0); } }, [open, total]);
  useEffect(() => () => controller.current?.abort(), []);
  const valid = Boolean(limits) && Number.isInteger(count) && count >= limits!.min && count <= limits!.max;

  const submit = async () => {
    if (!valid || status === 'working') return;
    controller.current = new AbortController();
    setStatus('working');
    try {
      const result = await run({ ...request, format, count }, controller.current.signal);
      download(result);
      setMessage(t('export.done', { n: numbers.format(result.rows) }));
      setStatus('done');
    } catch (error) {
      if (controller.current?.signal.aborted) return;
      setMessage(error instanceof ApiError && error.status < 500 ? error.message : t('grid.exportError'));
      setStatus('error');
    }
  };
  const close = () => { controller.current?.abort(); onClose(); };
  const option = (value: 'csv' | 'xlsx', label: string) => (
    <label className={cn('flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', format === value ? 'border-accent bg-accent/5 text-text' : 'border-border text-text-secondary hover:bg-surface-hover')}>
      <input type="radio" name="export-format" className="accent-(--color-accent)" checked={format === value} onChange={() => setFormat(value)} disabled={status === 'working'} />{label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title={t('export.title')} size="sm" footer={
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className="h-9 rounded-md border border-border px-3 text-sm font-medium text-text-secondary hover:bg-surface-hover">{status === 'done' ? t('common.close') : t('export.cancel')}</button>
        {status !== 'done' ? <button type="button" onClick={() => void submit()} disabled={!valid || status === 'working'} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"><DownloadSimple className="size-4" aria-hidden="true" />{status === 'working' ? t('export.working') : t('export.confirm')}</button> : null}
      </div>
    }>
      <div className="space-y-4 text-sm">
        <p className="text-text-secondary">{t('export.available', { n: numbers.format(total) })}</p>
        {!limits ? (
          <p role="status" className="rounded-lg border border-border bg-surface-hover p-3 text-text-secondary">{t('export.tooFew', { min: numbers.format(EXPORT_MIN_ROWS), n: numbers.format(total) })}</p>
        ) : (
          <>
            <fieldset className="space-y-1.5"><legend className="text-xs font-medium text-text-muted">{t('export.format')}</legend><div className="flex gap-2">{option('csv', 'CSV (.csv)')}{option('xlsx', 'Excel (.xlsx)')}</div></fieldset>
            <div className="space-y-1.5">
              <label htmlFor="export-count" className="text-xs font-medium text-text-muted">{t('export.count')}</label>
              <div className="flex items-center gap-3">
                <input type="range" aria-label={t('export.count')} min={limits.min} max={limits.max} step={limits.max - limits.min > 1_000 ? 100 : 1} value={Math.min(Math.max(count, limits.min), limits.max)} onChange={(event) => setCount(Number(event.target.value))} disabled={status === 'working' || limits.min === limits.max} className="min-w-0 flex-1 accent-(--color-accent)" />
                <input id="export-count" type="number" inputMode="numeric" min={limits.min} max={limits.max} value={Number.isNaN(count) ? '' : count} onChange={(event) => setCount(event.target.value === '' ? Number.NaN : Number(event.target.value))} disabled={status === 'working'} aria-invalid={!valid} className="h-9 w-28 rounded-md border border-border bg-surface px-2 text-right tabular-nums outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25" />
              </div>
              <p className={cn('text-xs', valid ? 'text-text-muted' : 'text-error')}>{t('export.range', { min: numbers.format(limits.min), max: numbers.format(limits.max) })}{total > EXPORT_MAX_ROWS ? ` ${t('export.capped', { n: numbers.format(EXPORT_MAX_ROWS) })}` : ''}</p>
            </div>
          </>
        )}
        {status === 'done' ? <p role="status" className="flex items-center gap-1.5 text-success"><CheckCircle className="size-4" aria-hidden="true" />{message}</p> : null}
        {status === 'error' ? <p role="alert" className="flex items-center gap-1.5 text-error"><WarningCircle className="size-4" aria-hidden="true" />{message}</p> : null}
      </div>
    </Dialog>
  );
}
