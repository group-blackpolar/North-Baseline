import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { Popover } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FacetValue } from './facetsApi';
import type { FilterScalar } from './filterModel';

export type FacetPage = { values: FacetValue[]; truncated: boolean; total?: number };
export type FacetPageLoader = (search: string, offset: number, signal: AbortSignal) => Promise<FacetPage>;

type LoadState = { status: 'loading' | 'ready' | 'error'; values: FacetValue[]; total: number | null; more: boolean; loadingMore: boolean };
const EMPTY: LoadState = { status: 'loading', values: [], total: null, more: false, loadingMore: false };
const display = (value: FilterScalar) => (typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value));

/** Summary shown on the trigger: nothing selected -> "all", one value -> the value, several -> a count. */
export function selectionSummary(selected: FilterScalar[], all: string, many: (count: number) => string): string {
  if (selected.length === 0) return all;
  return selected.length === 1 ? display(selected[0]!) : many(selected.length);
}

/**
 * Faceted selector: a field-labelled trigger that opens a popover with the search box on top and, right below, the REAL
 * values (with counts) as checkboxes. Values load in pages as the list is scrolled (nothing is downloaded up front), search
 * runs on the server, and values already selected stay listed (and checked) whatever the search or the other filters return.
 */
export function FacetSelect({ label, multi, selected, onChange, load }: {
  label: string;
  multi: boolean;
  selected: FilterScalar[];
  onChange: (values: FilterScalar[]) => void;
  load: FacetPageLoader;
}) {
  const { t, locale } = useI18n();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reloads, setReloads] = useState(0);
  const [state, setState] = useState<LoadState>(EMPTY);
  const loadRef = useRef(load);
  loadRef.current = load;
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // First page of every (re)query. The previous list stays on screen while a refinement loads (no skeleton flash).
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => (current.values.length ? { ...current, loadingMore: false } : EMPTY));
    loadRef.current(query, 0, controller.signal)
      .then((page) => { if (!controller.signal.aborted) setState({ status: 'ready', values: page.values, total: page.total ?? null, more: page.truncated, loadingMore: false }); })
      .catch(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, status: 'error', loadingMore: false })); });
    return () => controller.abort();
  }, [open, query, reloads]);

  const loadMore = useCallback(() => {
    setState((current) => {
      if (current.status !== 'ready' || !current.more || current.loadingMore) return current;
      const controller = controllerRef.current ?? new AbortController();
      loadRef.current(query, current.values.length, controller.signal)
        .then((page) => { if (!controller.signal.aborted) setState((latest) => ({ status: 'ready', values: [...latest.values, ...page.values.filter((item) => !latest.values.some((known) => known.value === item.value))], total: page.total ?? latest.total, more: page.truncated && page.values.length > 0, loadingMore: false })); })
        .catch(() => { if (!controller.signal.aborted) setState((latest) => ({ ...latest, status: 'error', loadingMore: false })); });
      return { ...current, loadingMore: true };
    });
  }, [query]);

  // Incremental loading: reaching the end of the list asks for the next page.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!open || !node) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadMore(); }, { rootMargin: '48px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, loadMore, state.values.length, state.more]);

  useEffect(() => { if (open) searchRef.current?.focus(); else { setSearch(''); setQuery(''); setState(EMPTY); } }, [open]);

  const toggle = useCallback((value: FilterScalar) => {
    const has = selected.includes(value);
    onChange(has ? selected.filter((item) => item !== value) : multi ? [...selected, value] : [value]);
  }, [multi, onChange, selected]);

  const number = useMemo(() => new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale), [locale]);
  const counts = new Map(state.values.map((item) => [item.value, item.count]));
  const loaded = state.values.flatMap((item) => (item.value === null ? [] : [item.value]));
  const rows: Array<{ value: FilterScalar; count?: number }> = [
    ...selected.map((value) => ({ value, count: counts.get(value) })),
    ...loaded.filter((value) => !selected.includes(value)).map((value) => ({ value, count: counts.get(value) })),
  ];
  const summary = selectionSummary(selected, t('flt.any'), (count) => t('flt.selectedN', { n: count }));

  return (
    <div className="min-w-0">
      <span className="mb-1 block truncate text-[0.7rem] font-semibold text-text-secondary">{label}</span>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${summary}`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border bg-surface px-3 text-left text-xs text-text transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min)',
          selected.length ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border',
          open && 'border-accent',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected.length === 0 && 'text-text-secondary')} title={summary}>{summary}</span>
        <CaretDown className={cn('size-3.5 shrink-0 text-text-muted transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchorRef} label={label} minWidth={300}>
        <div className="border-b border-border p-2">
          <label className="relative block">
            <span className="sr-only">{t('flt.searchLabel', { name: label })}</span>
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('flt.searchPlaceholder', { name: label })}
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-base outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-xs"
            />
          </label>
        </div>
        <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[0.7rem] text-text-secondary">
          <span>{t('flt.existing')}</span>
          {state.total !== null ? <span className="rounded-full bg-surface-hover px-1.5 tabular-nums">{number.format(state.total)}</span> : null}
        </div>
        <div id={listId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1" aria-busy={state.status === 'loading' || state.loadingMore}>
          {state.status === 'loading' && rows.length === 0 ? (
            <div className="space-y-1.5 p-2">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-5 w-full" />)}</div>
          ) : state.status === 'error' && rows.length === 0 ? (
            <div role="alert" className="space-y-2 p-3 text-center text-xs text-text-secondary">
              <p>{t('flt.loadError')}</p>
              <button type="button" className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-surface-hover" onClick={() => setReloads((value) => value + 1)}>{t('flt.retry')}</button>
            </div>
          ) : rows.length === 0 ? (
            <p role="status" className="p-3 text-center text-xs text-text-muted">{query ? t('flt.noResults') : t('flt.noValues')}</p>
          ) : (
            <ul className="space-y-px">
              {rows.map(({ value, count }) => {
                const checked = selected.includes(value);
                return (
                  <li key={String(value)}>
                    <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)', checked && 'bg-accent-soft/70')}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(value)} className="size-4 shrink-0 rounded accent-(--color-accent)" />
                      <span className="min-w-0 flex-1 truncate" title={display(value)}>{display(value)}</span>
                      {count !== undefined ? <span className="shrink-0 tabular-nums text-text-muted">{number.format(count)}</span> : null}
                    </label>
                  </li>
                );
              })}
              {state.more ? <li ref={sentinelRef} className="p-2 text-center text-[0.7rem] text-text-muted" aria-live="polite">{state.loadingMore ? t('flt.loadingMore') : ' '}</li> : null}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[0.72rem]">
          <span className="text-text-secondary">{t('flt.selectedCount', { n: selected.length })}</span>
          <button type="button" disabled={selected.length === 0} className="font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-40" onClick={() => onChange([])}>{t('flt.clearField')}</button>
        </div>
      </Popover>
    </div>
  );
}
