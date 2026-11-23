import { useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useResource } from '@/features/admin-center/hooks';
import { uploadAsset } from '@/lib/assets';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { categoriesApi, evaluationsApi } from './api';
import { useCategoryImage } from './useCategoryImage';
import type { CategoryRow, PerformanceLevel, Skill } from './model';

const field = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60';

/** Category of one evaluation (metadata: changing it does not create an unpublished revision). */
export function CategoryPicker({ organizationId, evaluationId, value, disabled, onChanged }: { organizationId: string; evaluationId: string; value: string | null; disabled: boolean; onChanged: (categoryId: string | null) => void }) {
  const { t } = useI18n();
  const list = useResource(() => categoriesApi.list(organizationId, true), [organizationId]);
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="block space-y-1"><span className="ui-label">{t('st.builder.category')}</span>
      <select className={field} value={value ?? ''} disabled={disabled || !list.data} onChange={(event) => { const next = event.target.value || null; setError(null); void evaluationsApi.setCategory(organizationId, evaluationId, next).then(() => onChanged(next)).catch((reason) => setError(reason instanceof Error ? reason.message : 'error')); }}>
        <option value="">{t('st.builder.noCategory')}</option>
        {(list.data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}{category.status === 'ARCHIVED' ? ` (${t('ev.status.ARCHIVED')})` : ''}</option>)}
      </select>
      {error ? <span role="alert" className="text-xs text-error">{error}</span> : null}
    </label>
  );
}

/** Performance levels of this evaluation: internal thresholds (label + minimum percentage), configurable per evaluation. */
export function LevelsEditor({ levels, disabled, onChange }: { levels: PerformanceLevel[]; disabled: boolean; onChange: (levels: PerformanceLevel[]) => void }) {
  const { t } = useI18n();
  const set = (index: number, patch: Partial<PerformanceLevel>) => onChange(levels.map((level, i) => (i === index ? { ...level, ...patch } : level)));
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="ui-label px-1">{t('st.builder.levels')}</legend>
      <p className="text-xs text-text-muted">{t('st.builder.levelsHint')}</p>
      {levels.map((level, index) => (
        <div key={level.key} className="grid gap-2 sm:grid-cols-[8rem_6rem_1fr_auto]">
          <input aria-label={t('st.builder.levelName')} className={field} value={level.label} maxLength={40} disabled={disabled} onChange={(event) => set(index, { label: event.target.value })} />
          <input aria-label={t('st.builder.levelMin')} type="number" min={0} max={100} className={field} value={level.minPercent} disabled={disabled} onChange={(event) => set(index, { minPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} />
          <input aria-label={t('st.builder.levelSummary')} className={field} value={level.summary ?? ''} maxLength={400} placeholder={t('st.builder.levelSummary')} disabled={disabled} onChange={(event) => set(index, { summary: event.target.value || undefined })} />
          <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.removeOption', { label: level.label })} disabled={disabled || levels.length < 2} onClick={() => onChange(levels.filter((_, i) => i !== index))}><Trash className="size-4" aria-hidden /></Button>
        </div>))}
      <Button size="sm" variant="outline" disabled={disabled || levels.length >= 8} onClick={() => onChange([...levels, { key: `level-${Date.now().toString(36)}`, label: '', minPercent: 100 }])}><Plus className="size-4" aria-hidden />{t('st.builder.addLevel')}</Button>
    </fieldset>
  );
}

/** Skills the questions can be tagged with: the data the feedback service turns into strengths, gaps, study topics and strategies. */
export function SkillsEditor({ skills, disabled, onChange }: { skills: Skill[]; disabled: boolean; onChange: (skills: Skill[]) => void }) {
  const { t } = useI18n();
  const set = (index: number, patch: Partial<Skill>) => onChange(skills.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)));
  const text = (index: number, key: 'strength' | 'gap' | 'study' | 'strategy', max: number) => (
    <label className="block space-y-1"><span className="text-xs text-text-secondary">{t(`st.builder.skill.${key}`)}</span><textarea className={cn(field, 'min-h-14 resize-y')} maxLength={max} value={skills[index]![key]} disabled={disabled} onChange={(event) => set(index, { [key]: event.target.value })} /></label>);
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="ui-label px-1">{t('st.builder.skills')}</legend>
      <p className="text-xs text-text-muted">{t('st.builder.skillsHint')}</p>
      {skills.map((skill, index) => (
        <details key={skill.id} className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-text">{skill.label || t('st.builder.skillNew')} <span className="font-normal text-text-muted">· {skill.competency}</span></summary>
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1"><span className="text-xs text-text-secondary">{t('st.builder.skill.label')}</span><input className={field} value={skill.label} maxLength={120} disabled={disabled} onChange={(event) => set(index, { label: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-text-secondary">{t('ev.builder.category')}</span><input className={field} value={skill.competency} maxLength={80} disabled={disabled} onChange={(event) => set(index, { competency: event.target.value })} /></label>
            </div>
            {text(index, 'strength', 240)}{text(index, 'gap', 240)}{text(index, 'study', 300)}{text(index, 'strategy', 300)}
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(skills.filter((_, i) => i !== index))}><Trash className="size-4" aria-hidden />{t('st.builder.skillRemove')}</Button>
          </div>
        </details>))}
      <Button size="sm" variant="outline" disabled={disabled || skills.length >= 200} onClick={() => onChange([...skills, { id: `skill-${Date.now().toString(36)}`, competency: '', label: '', strength: '', gap: '', study: '', strategy: '' }])}><Plus className="size-4" aria-hidden />{t('st.builder.addSkill')}</Button>
    </fieldset>
  );
}

const slug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'categoria';

/** Administration of the categories of the organization: name, description, colour, image, order and status. Needs evaluations.manage (the server decides). */
export function CategoryAdmin({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const { t } = useI18n();
  const list = useResource(() => categoriesApi.list(organizationId, true), [organizationId]);
  const [editing, setEditing] = useState<Partial<CategoryRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = useCategoryImage(organizationId, editing?.imageAssetId ?? null);
  const save = async () => {
    if (!editing?.name?.trim()) return;
    setBusy(true); setError(null);
    try {
      const body = { name: editing.name.trim(), description: editing.description?.trim() || null, color: editing.color ?? '#4f46e5', imageAssetId: editing.imageAssetId ?? null, position: editing.position ?? 0, status: editing.status ?? 'ACTIVE' };
      if (editing.id) await categoriesApi.update(organizationId, editing.id, body); else await categoriesApi.create(organizationId, { ...body, key: slug(editing.name) });
      setEditing(null); await list.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'error'); } finally { setBusy(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try { const asset = await uploadAsset(organizationId, file); setEditing((current) => ({ ...current, imageAssetId: asset.id })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'error'); } finally { setBusy(false); }
  };
  if (!list.data) return <Skeleton className="h-16 w-full rounded-xl" />;
  return (
    <section aria-label={t('st.builder.categories')} className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="ui-label">{t('st.builder.categories')}</h3>{canManage ? <Button size="sm" variant="outline" onClick={() => setEditing({ color: '#4f46e5', position: list.data!.categories.length })}><Plus className="size-4" aria-hidden />{t('st.builder.newCategory')}</Button> : null}</div>
      <ul className="divide-y divide-border">{list.data.categories.map((category) => (
        <li key={category.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: category.color }} />
          <span className="min-w-0 flex-1 basis-40 truncate font-medium text-text">{category.name}</span>
          {category.status === 'ARCHIVED' ? <Status tone="neutral">{t('ev.status.ARCHIVED')}</Status> : null}
          {canManage ? <Button size="sm" variant="ghost" onClick={() => setEditing(category)}>{t('st.builder.editCategory')}</Button> : null}
        </li>))}</ul>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !busy) setEditing(null); }} title={editing?.id ? t('st.builder.editCategory') : t('st.builder.newCategory')} size="sm"
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>{t('access.cancel')}</Button><Button variant="accent" loading={busy} disabled={!editing?.name?.trim()} onClick={() => void save()}>{t('ev.settings.save')}</Button></>}>
        {editing ? (
          <div className="space-y-3">
            <label className="block space-y-1"><span className="ui-label">{t('st.builder.catName')}</span><input className={field} value={editing.name ?? ''} maxLength={80} autoFocus onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label className="block space-y-1"><span className="ui-label">{t('ev.settings.description')}</span><textarea className={cn(field, 'min-h-16 resize-y')} value={editing.description ?? ''} maxLength={500} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className="ui-label">{t('st.builder.catColor')}</span><input type="color" className="h-10 w-full rounded-md border border-border bg-surface" value={editing.color ?? '#4f46e5'} onChange={(event) => setEditing({ ...editing, color: event.target.value })} /></label>
              <label className="space-y-1"><span className="ui-label">{t('st.builder.catOrder')}</span><input type="number" min={0} max={1000} className={field} value={editing.position ?? 0} onChange={(event) => setEditing({ ...editing, position: Math.max(0, Number(event.target.value) || 0) })} /></label>
            </div>
            <div className="space-y-1"><span className="ui-label">{t('st.builder.catImage')}</span>
              {image ? <img src={image} alt="" className="h-16 w-full rounded-md object-cover opacity-70" /> : null}
              <div className="flex flex-wrap gap-2"><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('st.builder.catImage')} className="text-xs" onChange={(event) => void upload(event.target.files?.[0])} />{editing.imageAssetId ? <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, imageAssetId: null })}>{t('st.builder.catImageRemove')}</Button> : null}</div></div>
            {editing.id ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.status === 'ARCHIVED'} onChange={(event) => setEditing({ ...editing, status: event.target.checked ? 'ARCHIVED' : 'ACTIVE' })} />{t('st.builder.catArchived')}</label> : null}
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
          </div>) : null}
      </Dialog>
    </section>
  );
}
