import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { Popover } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FacetValue } from './facetsApi';
import type { FilterScalar } from './filterModel';

type LoadState = { status: 'loading' | 'ready' | 'error'; values: FacetValue[]; truncated: boolean };
const display = (value: FilterScalar) => (typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value));

/**
 * Faceted selector: a button that opens a popover with a search box and the REAL values available (with counts),
 * each with a checkbox. Values already selected stay listed (and checked) even when the current search or the other
 * filters would not return them, so they can always be unchecked.
 */
export function FacetSelect({ label, multi, selected, onChange, load }: {
  label: string;
  multi: boolean;
  selected: FilterScalar[];
  onChange: (values: FilterScalar[]) => void;
  load: (search: string, signal: AbortSignal) => Promise<{ values: FacetValue[]; truncated: boolean }>;
}) {
  const { t, locale } = useI18n();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reloads, setReloads] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading', values: [], truncated: false });
  const loadRef = useRef(load);
  loadRef.current = load;

  // Debounce typing so every keystroke does not hit CORECROW.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // Keep the previous list on screen while refining (no flash of skeletons); only the very first load shows them.
    setState((current) => (current.values.length ? current : { status: 'loading', values: [], truncated: false }));
    loadRef.current(query, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setState({ status: 'ready', values: result.values, truncated: result.truncated }); })
      .catch(() => { if (!controller.signal.aborted) setState((current) => ({ ...current, status: 'error' })); });
    return () => controller.abort();
  }, [open, query, reloads]);

  useEffect(() => { if (open) searchRef.current?.focus(); else { setSearch(''); setQuery(''); setState({ status: 'loading', values: [], truncated: false }); } }, [open]);

  const toggle = useCallback((value: FilterScalar) => {
    const has = selected.includes(value);
    onChange(has ? selected.filter((item) => item !== value) : multi ? [...selected, value] : [value]);
  }, [multi, onChange, selected]);

  const counts = new Map(state.values.map((item) => [item.value, item.count]));
  const loaded = state.values.flatMap((item) => (item.value === null ? [] : [item.value]));
  const rows: Array<{ value: FilterScalar; count?: number }> = [
    ...selected.map((value) => ({ value, count: counts.get(value) })),
    ...loaded.filter((value) => !selected.includes(value)).map((value) => ({ value, count: counts.get(value) })),
  ];
  const number = new Intl.NumberFormat(locale);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-8 max-w-56 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-xs font-medium text-text transition-colors duration-(--duration-fast) pointer-coarse:h-(--touch-min) hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
          selected.length ? 'border-accent bg-accent-soft' : 'border-border',
        )}
      >
        <span className="truncate">{label}</span>
        {selected.length ? <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-white">{selected.length}</span> : null}
        <CaretDown className="size-3 shrink-0 text-text-muted" aria-hidden="true" />
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchorRef} label={label}>
        <div className="border-b border-border p-2">
          <label className="relative block">
            <span className="sr-only">{t('flt.searchLabel', { name: label })}</span>
            <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('flt.search')}
              className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2 text-base outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-xs"
            />
          </label>
        </div>
        <div id={listId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1" aria-busy={state.status === 'loading'}>
          {state.status === 'loading' && rows.length === 0 ? (
            <div className="space-y-1.5 p-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-5 w-full" />)}</div>
          ) : state.status === 'error' && rows.length === 0 ? (
            <div role="alert" className="space-y-2 p-3 text-center text-xs text-text-secondary">
              <p>{t('flt.loadError')}</p>
              <button type="button" className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-surface-hover" onClick={() => setReloads((value) => value + 1)}>{t('flt.retry')}</button>
            </div>
          ) : rows.length === 0 ? (
            <p role="status" className="p-3 text-center text-xs text-text-muted">{query ? t('flt.noResults') : t('flt.noValues')}</p>
          ) : (
            <ul className="space-y-0.5">
              {rows.map(({ value, count }) => {
                const checked = selected.includes(value);
                return (
                  <li key={String(value)}>
                    <label className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)', checked && 'bg-accent-soft/60')}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(value)} className="size-3.5 shrink-0 accent-(--color-accent)" />
                      <span className="min-w-0 flex-1 truncate" title={display(value)}>{display(value)}</span>
                      {count !== undefined ? <span className="shrink-0 tabular-nums text-text-muted">{number.format(count)}</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-[11px] text-text-muted">
          <span className="min-w-0 truncate">{state.truncated ? t('flt.truncated') : t('flt.countsNote')}</span>
          {selected.length ? <button type="button" className="shrink-0 font-medium text-accent hover:underline" onClick={() => onChange([])}>{t('flt.clearField')}</button> : null}
        </div>
      </Popover>
    </>
  );
}
