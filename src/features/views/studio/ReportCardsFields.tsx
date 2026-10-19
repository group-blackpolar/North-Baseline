import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { ICON_NAMES } from '@/features/analytics/pro/icons';
import { useViewsEditor } from '../ViewsEditorContext';
import { SelectField, TextField, ToggleField } from './fields';
import { newId as makeId } from '@/features/admin/contentDocument';
import type { Component } from './documentOps';

/** Pictures shipped with NORTH that a card may use (same-origin paths under /brand/; the document schema accepts only such paths). */
export const CARD_IMAGES = ['local-import', 'local-export', 'import-ctr', 'master-house', 'free-zone-import', 'free-zone-export', 'maritime-export'].map((slug) => `/brand/cards/${slug}.webp`);
const TONES = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan', 'slate'] as const;
type Item = { id: string; categorySlug: string; title: Record<string, string>; description?: Record<string, string>; icon?: string; tone?: string; image?: string };
const read = (value: Record<string, string> | undefined, locale: string) => value?.[locale] ?? '';
const write = (value: Record<string, string> | undefined, locale: string, text: string) => { const next = { ...(value ?? {}) }; if (text.trim()) next[locale] = text; else delete next[locale]; return next; };

/** Edit the report entries of a `report_cards` component: text in the editor's language, which report (category slug), icon, tone, picture, order. */
export function ReportCardsFields({ component, sectionId, locale }: { component: Component; sectionId: string; locale: string }) {
  const { t } = useI18n();
  const { updateComponentProps } = useViewsEditor();
  const items = (Array.isArray(component.props.items) ? component.props.items : []) as Item[];
  const set = (next: Item[]) => updateComponentProps(sectionId, component.id, { items: next });
  const patch = (index: number, change: Partial<Item>) => set(items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const move = (index: number, by: number) => { const target = index + by; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; set(next); };
  return (
    <div className="space-y-3">
      <TextField label={t('st.prop.title')} value={read(component.props.title as Record<string, string> | undefined, locale)} maxLength={120} onChange={(value) => updateComponentProps(sectionId, component.id, { title: write(component.props.title as Record<string, string> | undefined, locale, value) })} />
      {items.map((item, index) => (
        <fieldset key={item.id} className="space-y-2 rounded-lg border border-border p-2.5">
          <legend className="px-1 text-[11px] font-semibold text-text-secondary">{index + 1}. {read(item.title, locale) || item.categorySlug}</legend>
          <TextField label={t('st.prop.title')} value={read(item.title, locale)} maxLength={120} onChange={(value) => patch(index, { title: write(item.title, locale, value) || { [locale]: item.categorySlug } })} />
          <TextField label={t('st.prop.body')} value={read(item.description, locale)} maxLength={300} onChange={(value) => patch(index, { description: write(item.description, locale, value) })} />
          <TextField label={t('st.rc.category')} value={item.categorySlug} mono maxLength={63} help={t('st.rc.categoryHelp')} onChange={(value) => patch(index, { categorySlug: value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          <div className="grid grid-cols-2 gap-2">
            <SelectField label={t('st.rc.icon')} value={item.icon ?? 'chart'} options={ICON_NAMES.map((name) => ({ value: name, label: name }))} onChange={(value) => patch(index, { icon: value })} />
            <SelectField label={t('st.rc.tone')} value={item.tone ?? 'blue'} options={TONES.map((name) => ({ value: name, label: name }))} onChange={(value) => patch(index, { tone: value })} />
          </div>
          <SelectField label={t('st.rc.image')} value={item.image ?? ''} options={[{ value: '', label: t('st.rc.noImage') }, ...CARD_IMAGES.map((path) => ({ value: path, label: path.replace('/brand/cards/', '').replace('.webp', '') }))]} onChange={(value) => patch(index, { image: value || undefined })} />
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" aria-label={t('st.rc.up')} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-3.5" /></Button>
            <Button size="sm" variant="ghost" aria-label={t('st.rc.down')} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-3.5" /></Button>
            <Button size="sm" variant="ghost" className="ml-auto text-error" aria-label={t('st.rc.remove')} disabled={items.length <= 1} onClick={() => set(items.filter((_, i) => i !== index))}><Trash className="size-3.5" /></Button>
          </div>
        </fieldset>
      ))}
      {items.length < 12 ? <Button size="sm" variant="outline" onClick={() => set([...items, { id: makeId(), categorySlug: 'nuevo-reporte', title: { [locale]: t('st.rc.newReport') }, icon: 'chart', tone: 'blue' }])}><Plus aria-hidden="true" />{t('st.rc.add')}</Button> : null}
    </div>
  );
}

/** Text fields of a `hero` component (the schema keeps eyebrow, title and body per language). */
export function HeroFields({ component, sectionId, locale, labels }: { component: Component; sectionId: string; locale: string; labels: { eyebrow: string; title: string; body: string; centered: string; brand: string } }) {
  const { updateComponentProps } = useViewsEditor();
  const field = (key: 'eyebrow' | 'title' | 'body', label: string, max: number) => (
    <TextField label={label} value={read(component.props[key] as Record<string, string> | undefined, locale)} maxLength={max}
      onChange={(value) => { const next = write(component.props[key] as Record<string, string> | undefined, locale, value); updateComponentProps(sectionId, component.id, { [key]: key === 'title' && Object.keys(next).length === 0 ? { [locale]: '…' } : next }); }} />
  );
  return <>{field('eyebrow', labels.eyebrow, 80)}{field('title', labels.title, 160)}{field('body', labels.body, 600)}
    <ToggleField label={labels.centered} checked={component.props.centered === true} onChange={(value) => updateComponentProps(sectionId, component.id, { centered: value })} />
    <ToggleField label={labels.brand} checked={component.props.showBrand !== false} onChange={(value) => updateComponentProps(sectionId, component.id, { showBrand: value })} /></>;
}
