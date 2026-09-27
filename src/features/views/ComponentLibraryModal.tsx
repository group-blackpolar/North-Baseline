import { useState } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { componentTypes, type ComponentType } from '@/lib/northAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, AlignLeft, Gauge, Table2, Link2, List, CreditCard, Minus, Image, Video, FileText, Code2 } from 'lucide-react';

const icons: Record<ComponentType, typeof Type> = {
  heading: Type,
  rich_text: AlignLeft,
  metric: Gauge,
  table: Table2,
  link: Link2,
  list: List,
  card: CreditCard,
  divider: Minus,
  image: Image,
  video: Video,
  file: FileText,
  embed: Code2,
};

export function ComponentLibraryModal() {
  const { modal, setModal, addComponentToSection } = useViewsEditor();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  if (!modal || modal.type !== 'component_library') return null;

  const q = query.trim().toLowerCase();
  const items = componentTypes.filter((type) => (q ? type.includes(q) : true));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{t('views.library.title')}</h2>
          <Button variant="outline" size="sm" onClick={() => setModal(null)}>
            {t('views.cancel')}
          </Button>
        </div>
        <div className="mt-3">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('views.library.search')}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {items.map((type) => {
            const Icon = icons[type] ?? Type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => addComponentToSection(modal.sectionId, type)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-hover/40 px-3 py-2.5 text-left hover:border-accent hover:bg-accent/5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-text-secondary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-medium text-text">{t(`views.library.${type}`)}</span>
                  <span className="block text-[11px] text-text-muted">{t(`views.library.${type}Hint`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
