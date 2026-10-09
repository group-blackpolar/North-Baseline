import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChartBar, ChartDonut, ChartLine, Code, CreditCard, FileText, Gauge, Image, Link, ListBullets, MagnifyingGlass, Minus, Table, TextAlignLeft, TextT, VideoCamera, Lock, ChatsTeardrop } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { allDefinitions, CATEGORY_ORDER, type ComponentDefinition } from './registry';
import { categoryLabelKey, componentHintKey, componentLabelKey } from './labels';
import { LIBRARY_MIME } from './StudioCanvas';

const ICONS: Record<string, typeof TextT> = {
  heading: TextT, richText: TextAlignLeft, card: CreditCard, link: Link, list: ListBullets, divider: Minus, metric: Gauge,
  barChart: ChartBar, lineChart: ChartLine, donutChart: ChartDonut, table: Table, embed: Code, image: Image, video: VideoCamera, file: FileText, documents: ChatsTeardrop,
};

export interface LibraryHandle { focusSearch: () => void }

/** Catalog of components. Items can be dragged onto the canvas or added with the keyboard / the button (never drag-only). */
export const StudioLibrary = forwardRef<LibraryHandle, { onAdd: (type: string) => void; disabled?: boolean; inSheet?: boolean }>(function StudioLibrary({ onAdd, disabled, inSheet }, ref) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusSearch: () => searchRef.current?.focus() }), []);
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => CATEGORY_ORDER.map((category) => ({
    category,
    items: allDefinitions().filter((definition) => definition.category === category && definition.type !== 'document_workspace'
      && (!q || `${t(componentLabelKey(definition.type))} ${t(componentHintKey(definition.type))} ${definition.type}`.toLowerCase().includes(q))),
  })).filter((group) => group.items.length > 0), [q, t]);

  const renderItem = (definition: ComponentDefinition) => {
    const Glyph = ICONS[definition.iconKey] ?? TextT;
    const blocked = !definition.addable;
    return (
      <li key={definition.type}>
        <button
          type="button"
          draggable={!blocked && !disabled}
          disabled={disabled || blocked}
          onDragStart={(event) => { event.dataTransfer.setData(LIBRARY_MIME, definition.type); event.dataTransfer.effectAllowed = 'copy'; }}
          onClick={() => onAdd(definition.type)}
          title={blocked ? t('st.library.assetsBlocked') : undefined}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-left outline-none transition-[border-color,background-color] duration-(--duration-fast)',
            blocked || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:border-accent hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent/40 active:cursor-grabbing',
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-active text-text-secondary group-hover:text-accent">
            {blocked ? <Lock className="size-4" aria-hidden="true" /> : <Glyph className="size-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-text">{t(componentLabelKey(definition.type))}</span>
            <span className="block truncate text-[11px] text-text-muted">{t(componentHintKey(definition.type))}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        {inSheet ? null : <h2 className="font-display text-sm font-semibold text-text">{t('st.library.title')}</h2>}
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('st.library.search')}
            aria-label={t('st.library.search')}
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-text outline-none placeholder:text-text-muted focus:border-accent"
          />
        </div>
        <p className="text-[11px] leading-4 text-text-muted">{t('st.library.help')}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {groups.length === 0 ? <p className="py-6 text-center text-xs text-text-muted">{t('st.library.noResults')}</p> : null}
        {groups.map(({ category, items }) => (
          <section key={category} aria-labelledby={`lib-${category}`}>
            <h3 id={`lib-${category}`} className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t(categoryLabelKey(category))}</h3>
            <ul className="space-y-1.5">{items.map(renderItem)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
});
