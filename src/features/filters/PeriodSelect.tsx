import { CalendarBlank, CaretDown } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FacetValue } from './facetsApi';
import { classifyPeriod, describePeriod, isIsoDay, monthBounds, presetBounds, yearBounds, type PeriodPreset } from './periodModel';

export type PeriodLoader = (granularity: 'MONTH' | 'YEAR', signal: AbortSignal) => Promise<FacetValue[]>;

const PRESETS: Array<{ id: PeriodPreset; label: 'flt.preset.lastMonth' | 'flt.preset.last3Months' | 'flt.preset.last12Months' | 'flt.preset.yearToDate' | 'flt.preset.previousYear' }> = [
  { id: 'lastMonth', label: 'flt.preset.lastMonth' }, { id: 'last3Months', label: 'flt.preset.last3Months' }, { id: 'last12Months', label: 'flt.preset.last12Months' },
  { id: 'yearToDate', label: 'flt.preset.yearToDate' }, { id: 'previousYear', label: 'flt.preset.previousYear' },
];

const dayOf = (value: FacetValue['value']) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

/**
 * Period filter for a date field: presets anchored on the latest month that holds data, whole years and months that
 * actually exist (with record counts, from CORECROW), and a custom range. It always produces a closed [from, to] day range.
 */
export function PeriodSelect({ label, from, to, onChange, loadPeriods }: { label: string; from?: string; to?: string; onChange: (range: { from?: string; to?: string }) => void; loadPeriods?: PeriodLoader }) {
  const { t, locale } = useI18n();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; months: FacetValue[]; years: FacetValue[] }>({ status: 'loading', months: [], years: [] });
  const tag = locale === 'es' ? 'es-419' : locale;
  const number = useMemo(() => new Intl.NumberFormat(tag), [tag]);

  useEffect(() => {
    if (!open || !loadPeriods) return;
    const controller = new AbortController();
    setState((current) => (current.months.length ? current : { status: 'loading', months: [], years: [] }));
    Promise.all([loadPeriods('MONTH', controller.signal), loadPeriods('YEAR', controller.signal)])
      .then(([months, years]) => { if (!controller.signal.aborted) setState({ status: 'ready', months, years }); })
      .catch(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, status: 'error' })); });
    return () => controller.abort();
  }, [open, loadPeriods]);

  const latest = useMemo(() => { const first = dayOf(state.months[0]?.value ?? null); return first ? monthBounds(first).to : null; }, [state.months]);
  const selectedKind = classifyPeriod(from, to);
  const summary = from || to ? describePeriod(from, to, tag) : t('flt.any');
  const monthLabel = (iso: string) => new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00.000Z`));
  const apply = (range: { from?: string; to?: string }) => { onChange(range); };
  const item = 'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover';

  return (
    <div className="min-w-0">
      <span className="mb-1 block truncate text-[0.7rem] font-semibold text-text-secondary">{label}</span>
      <button ref={anchorRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${summary}`} onClick={() => setOpen((current) => !current)}
        className={cn('flex h-9 w-full items-center gap-2 rounded-lg border bg-surface px-3 text-left text-xs text-text transition-[border-color,box-shadow] hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min)', from || to ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border', open && 'border-accent')}>
        <CalendarBlank className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        <span className={cn('min-w-0 flex-1 truncate', !from && !to && 'text-text-secondary')} title={summary}>{summary}</span>
        <CaretDown className={cn('size-3.5 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchorRef} label={label} minWidth={340}>
        <div className="space-y-3 overflow-y-auto p-3">
          {latest ? (
            <section aria-label={t('flt.presets')}>
              <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">{t('flt.presets')}</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const bounds = presetBounds(preset.id, latest);
                  const active = from === bounds.from && to === bounds.to;
                  return <button key={preset.id} type="button" aria-pressed={active} onClick={() => { apply(bounds); setOpen(false); }} className={cn('rounded-full border px-2.5 py-1 text-[0.72rem] font-medium transition-colors', active ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text')}>{t(preset.label)}</button>;
                })}
              </div>
              <p className="mt-1.5 text-[0.68rem] text-text-muted">{t('flt.presetNote', { date: describePeriod(monthBounds(latest).from, latest, tag) })}</p>
            </section>
          ) : null}
          {loadPeriods ? (
            state.status === 'loading' && state.months.length === 0 ? <div className="space-y-1.5"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-3/4" /></div> : state.status === 'error' ? <p role="alert" className="text-xs text-text-secondary">{t('flt.loadError')}</p> : (
              <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                <section aria-label={t('flt.year')}>
                  <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">{t('flt.year')}</p>
                  <ul className="max-h-48 space-y-px overflow-y-auto">
                    {state.years.map((entry) => { const day = dayOf(entry.value); if (!day) return null; const year = Number(day.slice(0, 4)); const bounds = yearBounds(year); const active = selectedKind.kind === 'year' && from === bounds.from;
                      return <li key={year}><button type="button" aria-pressed={active} className={cn(item, active && 'bg-accent-soft text-accent')} onClick={() => apply(bounds)}><span className="font-medium">{year}</span><span className="tabular-nums text-text-muted">{number.format(entry.count)}</span></button></li>; })}
                  </ul>
                </section>
                <section aria-label={t('flt.month')}>
                  <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">{t('flt.month')}</p>
                  <ul className="max-h-48 space-y-px overflow-y-auto">
                    {state.months.map((entry) => { const day = dayOf(entry.value); if (!day) return null; const bounds = monthBounds(day); const active = selectedKind.kind === 'month' && from === bounds.from;
                      return <li key={day}><button type="button" aria-pressed={active} className={cn(item, active && 'bg-accent-soft text-accent')} onClick={() => { apply(bounds); setOpen(false); }}><span className="font-medium capitalize">{monthLabel(day)}</span><span className="tabular-nums text-text-muted">{number.format(entry.count)}</span></button></li>; })}
                  </ul>
                </section>
              </div>
            )
          ) : null}
          <section aria-label={t('flt.custom')}>
            <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">{t('flt.custom')}</p>
            <div className="flex items-center gap-1.5">
              <input type="date" aria-label={`${label} · ${t('flt.from')}`} value={isIsoDay(from) ? from : ''} max={isIsoDay(to) ? to : undefined} onChange={(event) => apply({ from: event.target.value || undefined, to })} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-xs" />
              <span aria-hidden="true" className="text-text-muted">–</span>
              <input type="date" aria-label={`${label} · ${t('flt.to')}`} value={isIsoDay(to) ? to : ''} min={isIsoDay(from) ? from : undefined} onChange={(event) => apply({ from, to: event.target.value || undefined })} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-xs" />
            </div>
          </section>
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[0.72rem]">
          <span className="truncate text-text-secondary">{from || to ? summary : t('flt.noPeriod')}</span>
          <button type="button" disabled={!from && !to} className="font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-40" onClick={() => { apply({}); setOpen(false); }}>{t('flt.clearField')}</button>
        </div>
      </Popover>
    </div>
  );
}
