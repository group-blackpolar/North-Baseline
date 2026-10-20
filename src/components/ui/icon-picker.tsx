import { useMemo, useState } from 'react';
import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { catalogEntry, ICON_CATALOG, ICON_GROUPS } from '@/lib/iconCatalog';
import { resolveIcon } from '@/lib/iconMap';

/** Icon chooser for categories, subcategories and views: search by name, grouped grid, "no icon" to clear. Stores the catalog key. */
export function IconPicker({ value, onChange, label }: { value: string | null | undefined; onChange: (key: string | null) => void; label?: string }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lang = locale === 'es' ? 'es' : 'en';
  const current = catalogEntry(value);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ICON_GROUPS.map((group) => ({
      ...group,
      icons: ICON_CATALOG.filter((entry) => entry.group === group.id && (needle === '' || entry.es.toLowerCase().includes(needle) || entry.en.toLowerCase().includes(needle) || entry.key.includes(needle))),
    })).filter((group) => group.icons.length > 0);
  }, [query]);

  const choose = (key: string | null) => { onChange(key); setOpen(false); setQuery(''); };

  return (
    <div>
      {label ? <span className="mb-1 block text-xs font-medium text-text-secondary">{label}</span> : null}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-sm text-text shadow-soft outline-none transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min)"
      >
        <span className="grid size-6 place-items-center rounded-md bg-surface-active text-accent"><Icon icon={resolveIcon(value)} size="md" weight="duotone" /></span>
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-text-muted')}>{current ? current[lang] : t('icon.picker.none')}</span>
        <CaretDown className="size-3.5 text-text-muted" aria-hidden="true" />
      </button>
      {open ? (
      <div role="group" aria-label={t('icon.picker.title')} className="mt-1 flex max-h-64 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        <div className="relative shrink-0 border-b border-border p-2">
          <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('icon.picker.search')}
            className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2 text-xs text-text outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? <p className="py-6 text-center text-xs text-text-muted">{t('icon.picker.empty')}</p> : groups.map((group) => (
            <section key={group.id} className="mb-2">
              <h3 className="ui-label px-1 pb-1 text-[10px]">{group[lang]}</h3>
              <div className="grid grid-cols-8 gap-1">
                {group.icons.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    title={entry[lang]}
                    aria-label={entry[lang]}
                    aria-pressed={current?.key === entry.key}
                    onClick={() => choose(entry.key)}
                    className={cn('grid size-9 place-items-center rounded-md transition-colors duration-(--duration-fast) pointer-coarse:size-(--touch-min)', current?.key === entry.key ? 'bg-accent-soft text-accent ring-1 ring-accent/40' : 'text-text-secondary hover:bg-surface-hover hover:text-text')}
                  >
                    <Icon icon={entry.icon} size="lg" weight="duotone" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <button type="button" onClick={() => choose(null)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text">
            <X className="size-3.5" aria-hidden="true" />{t('icon.picker.clear')}
          </button>
        </div>
      </div>
      ) : null}
    </div>
  );
}
