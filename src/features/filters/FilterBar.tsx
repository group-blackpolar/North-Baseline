import { useCallback, useEffect, useState } from 'react';
import { CaretUp, Funnel, X } from '@phosphor-icons/react';
import { ResponsiveFilters } from '@/components/ui/responsive-filters';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { FacetSelect, type FacetPage } from './FacetSelect';
import type { FacetGranularity, FacetValue } from './facetsApi';
import { activeCount, chipsOf, removeChip, type FilterMode, type FilterScalar, type FilterSelection, type FilterSelections } from './filterModel';
import { describePeriod } from './periodModel';
import { PeriodSelect } from './PeriodSelect';
import type { PanelBindingFilterDefinition } from '@/features/analytics/panelBindingQuery';

export type FilterControl = { fieldId: string; label: string; type: PanelBindingFilterDefinition['type']; operators: PanelBindingFilterDefinition['operators']; mode: FilterMode };
export type FacetLoader = (fieldId: string, search: string, offset: number, signal: AbortSignal, granularity?: FacetGranularity) => Promise<FacetPage>;

const inputClass = 'h-9 w-full rounded-lg border border-border bg-surface px-2 text-base text-text outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-text-muted hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min) md:text-xs';
const inputType = (type: FilterControl['type']) => (type === 'DATE' || type === 'DATETIME' ? 'date' : type === 'INTEGER' || type === 'DECIMAL' ? 'number' : 'text');
const isDate = (control: FilterControl) => control.type === 'DATE' || control.type === 'DATETIME';

/** A text box that applies after a short pause, so typing does not re-query every dashboard component per keystroke. */
function DebouncedInput({ value, onCommit, ...rest }: { value: string; onCommit: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onCommit(draft), 350);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit, value]);
  return <input {...rest} value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1 block truncate text-[0.7rem] font-semibold text-text-secondary">{label}</span>{children}</label>;
}

/**
 * Universal filter bar for a published panel. Filters are derived from the binding definitions CORECROW returns, never
 * hard-coded: categorical fields get a faceted multi-select with the real values (search on top, counts, incremental
 * loading), dates a period selector over the months and years that hold data, numbers a range and free text a contains
 * box. Active selections show as removable chips and apply live.
 */
export function FilterBar({ controls, selections, onChange, loadFacet, title }: {
  controls: FilterControl[];
  selections: FilterSelections;
  onChange: (selections: FilterSelections) => void;
  /** Absent where facet values are not available (e.g. the anonymous showcase): categorical fields fall back to text. */
  loadFacet?: FacetLoader;
  title?: string;
}) {
  const { t, locale } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const tag = locale === 'es' ? 'es-419' : locale;
  const set = useCallback((fieldId: string, next: FilterSelection) => onChange({ ...selections, [fieldId]: next }), [onChange, selections]);
  if (!controls.length) return null;
  const chips = chipsOf(controls, selections, String, (from, to) => describePeriod(from, to, tag));
  const count = activeCount(selections);

  const controlsView = controls.map((control) => {
    const selection = selections[control.fieldId];
    const faceted = (control.mode === 'multi' || control.mode === 'single') && loadFacet;
    if (faceted) {
      return (
        <FacetSelect
          key={control.fieldId}
          label={control.label}
          multi={control.mode === 'multi'}
          selected={selection?.values ?? []}
          onChange={(values: FilterScalar[]) => set(control.fieldId, { ...selection, values })}
          load={(search, offset, signal) => loadFacet(control.fieldId, search, offset, signal)}
        />
      );
    }
    if (control.mode === 'range' && isDate(control)) {
      return (
        <PeriodSelect
          key={control.fieldId}
          label={control.label}
          from={selection?.from}
          to={selection?.to}
          onChange={(range) => set(control.fieldId, { ...selection, from: range.from, to: range.to })}
          loadPeriods={loadFacet ? async (granularity, signal) => (await loadFacet(control.fieldId, '', 0, signal, granularity)).values as FacetValue[] : undefined}
        />
      );
    }
    if (control.mode === 'range') {
      const type = inputType(control.type);
      return (
        <fieldset key={control.fieldId} className="min-w-0">
          <legend className="mb-1 block truncate text-[0.7rem] font-semibold text-text-secondary">{control.label}</legend>
          <div className="flex items-center gap-1.5">
            <input type={type} aria-label={`${control.label} · ${t('flt.from')}`} className={inputClass} value={selection?.from ?? ''} max={selection?.to || undefined} onChange={(event) => set(control.fieldId, { ...selection, from: event.target.value })} />
            <span aria-hidden="true" className="text-text-muted">–</span>
            <input type={type} aria-label={`${control.label} · ${t('flt.to')}`} className={inputClass} value={selection?.to ?? ''} min={selection?.from || undefined} onChange={(event) => set(control.fieldId, { ...selection, to: event.target.value })} />
          </div>
        </fieldset>
      );
    }
    if (control.mode === 'none') return null;
    return (
      <Field key={control.fieldId} label={control.label}>
        <DebouncedInput className={inputClass} type="text" value={selection?.text ?? ''} onCommit={(text) => set(control.fieldId, { ...selection, text })} />
      </Field>
    );
  });

  return (
    <section className="np-card overflow-visible" role="group" aria-label={title || t('analytics.filters')}>
      <header className="flex items-center gap-2 px-4 py-2.5">
        <Funnel className="size-[18px] shrink-0 text-accent" weight="fill" aria-hidden="true" />
        <h3 className="font-display text-[0.95rem] font-semibold text-text">{title || t('flt.title')}</h3>
        {count > 0 ? <span className="rounded-full bg-accent px-1.5 text-[0.65rem] font-semibold tabular-nums text-white" aria-label={t('flt.activeCount', { n: count })}>{count}</span> : null}
        <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft">
          {collapsed ? t('flt.show') : t('flt.hide')}<CaretUp className={cn('size-3 transition-transform duration-150', collapsed && 'rotate-180')} aria-hidden="true" />
        </button>
      </header>
      {collapsed ? null : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-3 gap-y-2.5 px-4 pb-3">
          <ResponsiveFilters activeCount={count} onClear={() => onChange({})}>{controlsView}</ResponsiveFilters>
        </div>
      )}
      {chips.length ? (
        <div className="flex items-start gap-3 border-t border-border/70 px-4 py-2.5">
          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={t('flt.active')}>
            {chips.map((chip) => (
              <li key={chip.key}>
                <button type="button" aria-label={t('flt.remove', { name: chip.text })} onClick={() => onChange(removeChip(selections, chip))} className="inline-flex max-w-80 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1 text-[0.72rem] text-text transition-colors hover:border-accent/60 pointer-coarse:min-h-(--touch-min)">
                  <span className="truncate" title={chip.text}><span className="text-text-secondary">{chip.label}: </span><span className="font-semibold">{chip.display}</span></span>
                  <X className="size-3 shrink-0 text-text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft" onClick={() => onChange({})}>{t('flt.clearAll')}</button>
        </div>
      ) : null}
    </section>
  );
}
