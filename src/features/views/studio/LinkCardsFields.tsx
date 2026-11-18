import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { ICON_NAMES } from '@/features/analytics/pro/icons';
import { newId as makeId } from '@/features/admin/contentDocument';
import { useViewsEditor } from '../ViewsEditorContext';
import { SelectField, TextField } from './fields';
import type { Component } from './documentOps';

const TONES = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan', 'slate'] as const;
type Item = { id: string; title: Record<string, string>; description?: Record<string, string>; panelSlug?: string; href?: string; icon?: string; tone?: string };
const read = (value: Record<string, string> | undefined, locale: string) => value?.[locale] ?? '';
const write = (value: Record<string, string> | undefined, locale: string, text: string) => { const next = { ...(value ?? {}) }; if (text.trim()) next[locale] = text; else delete next[locale]; return next; };
const isUrl = (value: string) => { try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; } };

/** Quick links: cards that open another published panel of the organization (slug) or an external page (URL). */
export function LinkCardsFields({ component, sectionId, locale }: { component: Component; sectionId: string; locale: string }) {
  const { t } = useI18n();
  const { updateComponentProps } = useViewsEditor();
  const items = (Array.isArray(component.props.items) ? component.props.items : []) as Item[];
  const set = (next: Item[]) => updateComponentProps(sectionId, component.id, { items: next });
  const patch = (index: number, change: Partial<Item>) => set(items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const move = (index: number, by: number) => { const target = index + by; if (target < 0 || target >= items.length) return; const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; set(next); };
  // A card takes exactly one target: the field edited last wins and the other is removed (CORECROW rejects both).
  const setTarget = (index: number, kind: 'panelSlug' | 'href', value: string) => patch(index, kind === 'href' ? { href: value || undefined, panelSlug: undefined } : { panelSlug: value.toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined, href: undefined });
  return (
    <div className="space-y-3">
      <TextField label={t('st.prop.title')} value={read(component.props.title as Record<string, string> | undefined, locale)} maxLength={120} onChange={(value) => updateComponentProps(sectionId, component.id, { title: write(component.props.title as Record<string, string> | undefined, locale, value) })} />
      {items.map((item, index) => (
        <fieldset key={item.id} className="space-y-2 rounded-lg border border-border p-2.5">
          <legend className="px-1 text-[11px] font-semibold text-text-secondary">{index + 1}. {read(item.title, locale) || '…'}</legend>
          <TextField label={t('st.prop.title')} value={read(item.title, locale)} maxLength={120} onChange={(value) => patch(index, { title: write(item.title, locale, value) })} />
          <TextField label={t('st.prop.body')} value={read(item.description, locale)} maxLength={300} onChange={(value) => patch(index, { description: write(item.description, locale, value) })} />
          <TextField label={t('st.lc.panel')} value={item.panelSlug ?? ''} mono maxLength={63} help={t('st.lc.panelHelp')} onChange={(value) => setTarget(index, 'panelSlug', value)} />
          <TextField label={t('st.lc.url')} value={item.href ?? ''} mono maxLength={2048} placeholder="https://" onChange={(value) => setTarget(index, 'href', value)} />
          {item.href && !isUrl(item.href) ? <p className="text-[11px] text-error">{t('st.lc.urlInvalid')}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <SelectField label={t('st.rc.icon')} value={item.icon ?? 'link'} options={ICON_NAMES.map((name) => ({ value: name, label: name }))} onChange={(value) => patch(index, { icon: value })} />
            <SelectField label={t('st.rc.tone')} value={item.tone ?? 'blue'} options={TONES.map((name) => ({ value: name, label: name }))} onChange={(value) => patch(index, { tone: value })} />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" aria-label={t('st.rc.up')} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-3.5" /></Button>
            <Button size="sm" variant="ghost" aria-label={t('st.rc.down')} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-3.5" /></Button>
            <Button size="sm" variant="ghost" className="ml-auto text-error" aria-label={t('st.rc.remove')} disabled={items.length <= 1} onClick={() => set(items.filter((_, i) => i !== index))}><Trash className="size-3.5" /></Button>
          </div>
        </fieldset>
      ))}
      {items.length < 12 ? <Button size="sm" variant="outline" onClick={() => set([...items, { id: makeId(), title: { [locale]: t('st.lc.new') }, href: 'https://example.com', icon: 'link', tone: 'blue' }])}><Plus className="size-3.5" />{t('st.rc.add')}</Button> : null}
    </div>
  );
}
