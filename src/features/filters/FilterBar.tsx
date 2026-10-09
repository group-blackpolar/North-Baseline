import { useEffect, useState } from 'react';
import { Funnel, X } from '@phosphor-icons/react';
import { ResponsiveFilters } from '@/components/ui/responsive-filters';
import { useI18n } from '@/lib/i18n';
import { FacetSelect } from './FacetSelect';
import type { FacetValue } from './facetsApi';
import { activeCount, chipsOf, removeChip, type FilterMode, type FilterScalar, type FilterSelection, type FilterSelections } from './filterModel';
import type { PanelBindingFilterDefinition } from '@/features/analytics/panelBindingQuery';

export type FilterControl = { fieldId: string; label: string; type: PanelBindingFilterDefinition['type']; operators: PanelBindingFilterDefinition['operators']; mode: FilterMode };
export type FacetLoader = (fieldId: string, search: string, signal: AbortSignal) => Promise<{ values: FacetValue[]; truncated: boolean }>;

const inputClass = 'h-8 rounded-md border border-border bg-surface px-2 text-base text-text outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-text-muted hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min) md:text-xs';
const inputType = (type: FilterControl['type']) => (type === 'DATE' || type === 'DATETIME' ? 'date' : type === 'INTEGER' || type === 'DECIMAL' ? 'number' : 'text');

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

/**
 * Universal filter bar for a published panel. Filters are derived from the binding definitions CORECROW returns, never
 * hard-coded: categorical fields get a faceted multi-select with the real values, dates/numbers a range, free text a
 * contains box. Active selections show as removable chips and apply live.
 */
export function FilterBar({ controls, selections, onChange, loadFacet }: {
  controls: FilterControl[];
  selections: FilterSelections;
  onChange: (selections: FilterSelections) => void;
  /** Absent where facet values are not available (e.g. the anonymous showcase): categorical fields fall back to text. */
  loadFacet?: FacetLoader;
}) {
  const { t } = useI18n();
  if (!controls.length) return null;
  const set = (fieldId: string, next: FilterSelection) => onChange({ ...selections, [fieldId]: next });
  const chips = chipsOf(controls, selections);
  const count = activeCount(selections);

  return (
    <div className="space-y-2" role="group" aria-label={t('analytics.filters')}>
      <div className="np-card flex flex-wrap items-center gap-2 px-3 py-2">
        <Funnel className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <ResponsiveFilters activeCount={count} onClear={() => onChange({})}>
          {controls.map((control) => {
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
                  load={(search, signal) => loadFacet(control.fieldId, search, signal)}
                />
              );
            }
            if (control.mode === 'range') {
              const type = inputType(control.type);
              return (
                <fieldset key={control.fieldId} className="flex items-center gap-1.5">
                  <legend className="sr-only">{control.label}</legend>
                  <span className="ui-label">{control.label}</span>
                  <input type={type} aria-label={`${control.label} · ${t('flt.from')}`} className={inputClass} value={selection?.from ?? ''} max={selection?.to || undefined} onChange={(event) => set(control.fieldId, { ...selection, from: event.target.value })} />
                  <span aria-hidden="true" className="text-text-muted">–</span>
                  <input type={type} aria-label={`${control.label} · ${t('flt.to')}`} className={inputClass} value={selection?.to ?? ''} min={selection?.from || undefined} onChange={(event) => set(control.fieldId, { ...selection, to: event.target.value })} />
                </fieldset>
              );
            }
            if (control.mode === 'none') return null;
            return (
              <label key={control.fieldId} className="flex items-center gap-1.5">
                <span className="ui-label">{control.label}</span>
                <DebouncedInput className={`${inputClass} w-40`} type="text" value={selection?.text ?? ''} onCommit={(text) => set(control.fieldId, { ...selection, text })} />
              </label>
            );
          })}
        </ResponsiveFilters>
        {count > 0 ? <button type="button" className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text" onClick={() => onChange({})}>{t('flt.clearAll')}</button> : null}
      </div>
      {chips.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('flt.active')}>
          {chips.map((chip) => (
            <li key={chip.key}>
              <button type="button" aria-label={t('flt.remove', { name: chip.text })} onClick={() => onChange(removeChip(selections, chip))} className="inline-flex max-w-72 items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-0.5 text-[11px] text-accent hover:bg-accent/15 pointer-coarse:min-h-(--touch-min)">
                <span className="truncate" title={chip.text}>{chip.text}</span>
                <X className="size-3 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
