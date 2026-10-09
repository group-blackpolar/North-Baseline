import { useMemo, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { localName, type ViewFilters, type ViewResource } from './resources';

const KINDS = ['CATEGORY', 'SUBCATEGORY', 'PANEL'] as const;
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ACTIVE'] as const;
const AUDIENCES = ['ALL_MEMBERS', 'ROLES', 'GROUPS', 'PERMISSIONS', 'SPECIFIC_USERS'] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="min-w-0 space-y-1.5"><legend className="ui-label mb-1">{title}</legend>{children}</fieldset>;
}

function Check({ checked, onChange, children, count }: { checked: boolean; onChange: () => void; children: ReactNode; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-text-secondary transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-text pointer-coarse:min-h-(--touch-min)">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--color-accent)]" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined ? <span className="shrink-0 text-[10px] tabular-nums text-text-muted">{count}</span> : null}
    </label>
  );
}

const flip = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

/** Combinable filters: OR inside a group (several values), AND between groups. Nothing here is cosmetic — every control feeds `applyFilters`. */
export function FilterPanel({ filters, resources, onChange, onClear, active }: { filters: ViewFilters; resources: ViewResource[]; onChange: (patch: Partial<ViewFilters>) => void; onClear: () => void; active: number }) {
  const { t, locale } = useI18n();
  const categories = useMemo(() => resources.filter((resource) => resource.kind === 'CATEGORY'), [resources]);
  const subcategories = useMemo(() => resources.filter((resource) => resource.kind === 'SUBCATEGORY' && (!filters.categoryIds.length || filters.categoryIds.includes(resource.categoryId))), [resources, filters.categoryIds]);
  const counts = useMemo(() => {
    const count = (pick: (resource: ViewResource) => string | null) => {
      const map = new Map<string, number>();
      for (const resource of resources) { const key = pick(resource); if (key) map.set(key, (map.get(key) ?? 0) + 1); }
      return map;
    };
    return { kind: count((r) => r.kind), status: count((r) => r.status), audience: count((r) => r.audienceType) };
  }, [resources]);

  return (
    <div className="@container space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">{t('adm2.filters.logic')}</p>
        <button type="button" onClick={onClear} disabled={active === 0} className="shrink-0 rounded px-1.5 py-0.5 text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline">{t('adm2.filters.clear')}</button>
      </div>
      <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @4xl:grid-cols-4">
        <Group title={t('adm2.filters.type')}>
          {KINDS.map((kind) => <Check key={kind} checked={filters.kinds.includes(kind)} onChange={() => onChange({ kinds: flip(filters.kinds, kind) })} count={counts.kind.get(kind) ?? 0}>{t(`adm2.views.kind.${kind}` as never)}</Check>)}
        </Group>
        <Group title={t('adm2.filters.status')}>
          {STATUSES.map((status) => <Check key={status} checked={filters.statuses.includes(status)} onChange={() => onChange({ statuses: flip(filters.statuses, status) })} count={counts.status.get(status) ?? 0}>{t(`adm2.views.status.${status}` as never)}</Check>)}
          <Check checked={filters.unpublishedOnly} onChange={() => onChange({ unpublishedOnly: !filters.unpublishedOnly })}>{t('adm2.views.status.unpublished')}</Check>
          <p className="px-1.5 text-[10px] leading-snug text-text-muted">{t('adm2.filters.statusNote')}</p>
        </Group>
        <Group title={t('adm2.filters.category')}>
          <div className="max-h-36 space-y-0.5 overflow-y-auto pr-1">
            {categories.map((category) => <Check key={category.id} checked={filters.categoryIds.includes(category.id)} onChange={() => onChange({ categoryIds: flip(filters.categoryIds, category.id), subcategoryIds: [] })} count={category.childCount}>{localName(category.name, locale)}</Check>)}
            {categories.length === 0 ? <p className="px-1.5 text-xs text-text-muted">—</p> : null}
          </div>
        </Group>
        <Group title={t('adm2.filters.subcategory')}>
          <div className="max-h-36 space-y-0.5 overflow-y-auto pr-1">
            {subcategories.map((subcategory) => <Check key={subcategory.id} checked={filters.subcategoryIds.includes(subcategory.id)} onChange={() => onChange({ subcategoryIds: flip(filters.subcategoryIds, subcategory.id) })} count={subcategory.childCount}>{localName(subcategory.name, locale)}</Check>)}
            {subcategories.length === 0 ? <p className="px-1.5 text-xs text-text-muted">—</p> : null}
          </div>
        </Group>
        <Group title={t('adm2.filters.audience')}>
          {AUDIENCES.map((audience) => <Check key={audience} checked={filters.audiences.includes(audience)} onChange={() => onChange({ audiences: flip(filters.audiences, audience) })} count={counts.audience.get(audience) ?? 0}>{t(`adm2.views.audience.${audience}` as never)}</Check>)}
        </Group>
        <Group title={t('adm2.filters.origin')}>
          {(['all', 'content', 'system'] as const).map((origin) => (
            <label key={origin} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-text-secondary hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
              <input type="radio" name="views-origin" checked={filters.origin === origin} onChange={() => onChange({ origin })} className="accent-[var(--color-accent)]" />{t(`adm2.filters.origin.${origin}` as never)}
            </label>
          ))}
        </Group>
        <Group title={t('adm2.filters.updated')}>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="space-y-0.5"><span className="sr-only">{t('adm2.filters.from')}</span><Input type="date" aria-label={t('adm2.filters.updated') + ' ' + t('adm2.filters.from')} value={filters.updatedFrom} max={filters.updatedTo || undefined} onChange={(event) => onChange({ updatedFrom: event.target.value })} /></label>
            <label className="space-y-0.5"><span className="sr-only">{t('adm2.filters.to')}</span><Input type="date" aria-label={t('adm2.filters.updated') + ' ' + t('adm2.filters.to')} value={filters.updatedTo} min={filters.updatedFrom || undefined} onChange={(event) => onChange({ updatedTo: event.target.value })} /></label>
          </div>
        </Group>
        <Group title={t('adm2.filters.created')}>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="space-y-0.5"><span className="sr-only">{t('adm2.filters.from')}</span><Input type="date" aria-label={t('adm2.filters.created') + ' ' + t('adm2.filters.from')} value={filters.createdFrom} max={filters.createdTo || undefined} onChange={(event) => onChange({ createdFrom: event.target.value })} /></label>
            <label className="space-y-0.5"><span className="sr-only">{t('adm2.filters.to')}</span><Input type="date" aria-label={t('adm2.filters.created') + ' ' + t('adm2.filters.to')} value={filters.createdTo} min={filters.createdFrom || undefined} onChange={(event) => onChange({ createdTo: event.target.value })} /></label>
          </div>
        </Group>
      </div>
    </div>
  );
}

/** One removable chip per active constraint, so what narrows the result is always visible. */
export function FilterChips({ filters, resources, onChange }: { filters: ViewFilters; resources: ViewResource[]; onChange: (patch: Partial<ViewFilters>) => void }) {
  const { t, locale } = useI18n();
  const name = (id: string) => { const resource = resources.find((item) => item.id === id); return resource ? localName(resource.name, locale) : id; };
  const chips: Array<{ id: string; label: string; remove: () => void }> = [
    ...(filters.q.trim() ? [{ id: 'q', label: `“${filters.q.trim()}”`, remove: () => onChange({ q: '' }) }] : []),
    ...filters.kinds.map((kind) => ({ id: `k:${kind}`, label: t(`adm2.views.kind.${kind}` as never), remove: () => onChange({ kinds: filters.kinds.filter((v) => v !== kind) }) })),
    ...filters.statuses.map((status) => ({ id: `s:${status}`, label: t(`adm2.views.status.${status}` as never), remove: () => onChange({ statuses: filters.statuses.filter((v) => v !== status) }) })),
    ...filters.categoryIds.map((id) => ({ id: `c:${id}`, label: `${t('adm2.filters.category')}: ${name(id)}`, remove: () => onChange({ categoryIds: filters.categoryIds.filter((v) => v !== id) }) })),
    ...filters.subcategoryIds.map((id) => ({ id: `u:${id}`, label: `${t('adm2.filters.subcategory')}: ${name(id)}`, remove: () => onChange({ subcategoryIds: filters.subcategoryIds.filter((v) => v !== id) }) })),
    ...filters.audiences.map((audience) => ({ id: `a:${audience}`, label: t(`adm2.views.audience.${audience}` as never), remove: () => onChange({ audiences: filters.audiences.filter((v) => v !== audience) }) })),
    ...(filters.unpublishedOnly ? [{ id: 'unpub', label: t('adm2.views.status.unpublished'), remove: () => onChange({ unpublishedOnly: false }) }] : []),
    ...(filters.origin !== 'all' ? [{ id: 'origin', label: t(`adm2.filters.origin.${filters.origin}` as never), remove: () => onChange({ origin: 'all' }) }] : []),
    ...(filters.updatedFrom || filters.updatedTo ? [{ id: 'upd', label: `${t('adm2.filters.updated')}: ${filters.updatedFrom || '…'} → ${filters.updatedTo || '…'}`, remove: () => onChange({ updatedFrom: '', updatedTo: '' }) }] : []),
    ...(filters.createdFrom || filters.createdTo ? [{ id: 'cre', label: `${t('adm2.filters.created')}: ${filters.createdFrom || '…'} → ${filters.createdTo || '…'}`, remove: () => onChange({ createdFrom: '', createdTo: '' }) }] : []),
  ];
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label={t('adm2.filters.active')}>
      {chips.map((chip) => (
        <li key={chip.id} className={cn('np-fade-in inline-flex max-w-full items-center gap-1 rounded-full border border-accent/40 bg-accent-soft py-0.5 pl-2.5 pr-1 text-[11px] text-accent')}>
          <span className="truncate">{chip.label}</span>
          <button type="button" onClick={chip.remove} aria-label={t('adm2.filters.remove', { name: chip.label })} className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-accent/15 pointer-coarse:size-6"><X className="size-3" /></button>
        </li>
      ))}
    </ul>
  );
}
