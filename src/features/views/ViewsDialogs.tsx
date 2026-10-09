import { DialogFrame } from '@/components/ui/dialog';
import { useState } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import {
  createCategory,
  createSubcategory,
  createPanel,
  updateCategory,
  updateSubcategory,
  updatePanel,
  saveDraft,
} from '@/lib/northAdmin';
import { createDocumentFromTemplate, type ViewTemplateId } from './viewTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ViewsDialogs() {
  const { modal, setModal, organizationId, refreshTaxonomy, selectPanel } = useViewsEditor();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState<ViewTemplateId>('blank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!modal) return null;

  const handleClose = () => {
    setName('');
    setSlug('');
    setError(null);
    setLoading(false);
    setModal(null);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createCategory(organizationId, {
        name: { es: name.trim(), en: name.trim() },
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      });
      await refreshTaxonomy();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating category');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || modal?.type !== 'create_subcategory') return;
    setLoading(true);
    setError(null);
    try {
      await createSubcategory(organizationId, modal.categoryId, {
        name: { es: name.trim(), en: name.trim() },
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      });
      await refreshTaxonomy();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating subcategory');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || modal?.type !== 'create_view') return;
    setLoading(true);
    setError(null);
    try {
      const created = await createPanel(organizationId, modal.subcategoryId, {
        name: { es: name.trim(), en: name.trim() },
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      });
      const initialDoc = createDocumentFromTemplate(template, name.trim());
      await saveDraft(organizationId, created.id, initialDoc);
      await refreshTaxonomy();
      selectPanel(modal.categoryId, modal.subcategoryId, created.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating view');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || modal?.type !== 'rename') return;
    setLoading(true);
    setError(null);
    try {
      const input = {
        name: { es: name.trim(), en: name.trim() },
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      };
      if (modal.resourceType === 'category') {
        await updateCategory(organizationId, modal.id, input);
      } else if (modal.resourceType === 'subcategory') {
        await updateSubcategory(organizationId, modal.id, input);
      } else {
        await updatePanel(organizationId, modal.id, input);
      }
      await refreshTaxonomy();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error renaming resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogFrame open onOpenChange={(open) => { if (!open) handleClose(); }} label={t('views.title')}>
      <div>
        {modal.type === 'create_category' && (
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <h2 className="text-base font-semibold text-text">{t('views.createCategoryTitle')}</h2>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.nameLabel')}
                <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operaciones" className="mt-1" />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.slugLabel')}
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="e.g. operaciones" className="mt-1" />
                <span className="mt-1 block text-[11px] text-text-muted">{t('views.slugHint')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>{t('views.cancel')}</Button>
              <Button type="submit" size="sm" disabled={loading || !name.trim()}>{loading ? t('views.savingState') : t('views.create')}</Button>
            </div>
          </form>
        )}
        {modal.type === 'create_subcategory' && (
          <form onSubmit={handleCreateSubcategory} className="space-y-4">
            <h2 className="text-base font-semibold text-text">{t('views.createSubcategoryTitle')}</h2>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.nameLabel')}
                <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Logística" className="mt-1" />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.slugLabel')}
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="e.g. logistica" className="mt-1" />
                <span className="mt-1 block text-[11px] text-text-muted">{t('views.slugHint')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>{t('views.cancel')}</Button>
              <Button type="submit" size="sm" disabled={loading || !name.trim()}>{loading ? t('views.savingState') : t('views.create')}</Button>
            </div>
          </form>
        )}
        {modal.type === 'create_view' && (
          <form onSubmit={handleCreateView} className="space-y-4">
            <h2 className="text-base font-semibold text-text">{t('views.createViewTitle')}</h2>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.nameLabel')}
                <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manifiestos" className="mt-1" />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.slugLabel')}
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="e.g. manifiestos" className="mt-1" />
                <span className="mt-1 block text-[11px] text-text-muted">{t('views.slugHint')}</span>
              </label>
              <div>
                <span className="block text-xs font-medium text-text-secondary mb-1.5">{t('views.templateLabel')}</span>
                <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1">
                  {(
                    [
                      { id: 'blank', title: t('st.tpl.blank'), hint: t('st.tpl.blank.hint') },
                      { id: 'executive', title: t('st.tpl.executive'), hint: t('st.tpl.executive.hint') },
                      { id: 'analytics', title: t('st.tpl.analytics'), hint: t('st.tpl.analytics.hint') },
                      { id: 'operations', title: t('st.tpl.operations'), hint: t('st.tpl.operations.hint') },
                      { id: 'explorer', title: t('st.tpl.explorer'), hint: t('st.tpl.explorer.hint') },
                      { id: 'presentation', title: t('st.tpl.presentation'), hint: t('st.tpl.presentation.hint') },
                    ] as const
                  ).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplate(tpl.id)}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        template === tpl.id ? 'border-accent bg-accent/5 font-medium text-accent' : 'border-border bg-surface-hover/50 text-text-secondary'
                      }`}
                    >
                      <span className="min-w-0"><span className="block">{tpl.title}</span><span className="block truncate text-[11px] font-normal text-text-muted">{tpl.hint}</span></span>
                      {template === tpl.id && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>{t('views.cancel')}</Button>
              <Button type="submit" size="sm" disabled={loading || !name.trim()}>{loading ? t('views.savingState') : t('views.create')}</Button>
            </div>
          </form>
        )}
        {modal.type === 'rename' && (
          <form onSubmit={handleRename} className="space-y-4">
            <h2 className="text-base font-semibold text-text">{t('views.renameTitle')}</h2>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.nameLabel')}
                <Input required autoFocus defaultValue={modal.currentName} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                {t('views.slugLabel')}
                <Input defaultValue={modal.currentSlug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className="mt-1" />
                <span className="mt-1 block text-[11px] text-text-muted">{t('views.slugHint')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>{t('views.cancel')}</Button>
              <Button type="submit" size="sm" disabled={loading}>{loading ? t('views.savingState') : t('views.confirm')}</Button>
            </div>
          </form>
        )}
      </div>
    </DialogFrame>
  );
}
