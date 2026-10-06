import { useCallback, useEffect, useState } from 'react';
import { CaretRight, CircleNotch, FileText, FolderPlus, Plus, ShieldCheck, Stack, WarningCircle } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/empty-state';
import { useCatalog } from '@/context/CatalogContext';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { useI18n } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import {
  createCategory,
  createPanel,
  createSubcategory,
  listAuthorizedTaxonomy,
  type ManagementCategory,
} from '@/lib/northAdmin';
import { PanelEditor } from './PanelEditor';

type FormKind = 'category' | 'subcategory' | 'panel';
const localName = (value: Record<string, string>, locale: string) => value[locale] ?? value.es ?? value.en ?? Object.values(value)[0] ?? '';

function requestError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message}${error.requestId ? ` (${error.requestId})` : ''}`;
  }
  return error instanceof Error ? error.message : 'Request failed';
}

function panelStatusClass(status: TaxonomyPanelStatus) {
  if (status === 'PUBLISHED') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'DRAFT') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-surface-hover text-text-muted line-through';
}

type TaxonomyPanelStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export function OrganizationAdminView({ organizationId }: { organizationId: string }) {
  const { locale, t } = useI18n();
  const { refresh: refreshCatalog } = useCatalog();
  const appError = useAppErrorSafe();
  const [taxonomy, setTaxonomy] = useState<ManagementCategory[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [mutationError, setMutationError] = useState('');
  const [catalogWarning, setCatalogWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormKind>('category');
  const [selection, setSelection] = useState<{ categoryId?: string; subcategoryId?: string; panelId?: string }>({});
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (initial = false) => {
    if (initial) { setLoading(true); setLoadError(null); }
    try {
      setTaxonomy(await listAuthorizedTaxonomy(organizationId));
      return true;
    } catch (next) {
      const apiError = next instanceof ApiError ? next : new ApiError(0, requestError(next));
      if (apiError.status === 401) appError?.classifyAndRaise(apiError);
      // An access denial must always remove this protected surface. A transient
      // refresh failure after a successful mutation keeps the last known tree.
      if (initial || apiError.status === 401 || apiError.status === 403 || apiError.status === 404) setLoadError(apiError);
      else setMutationError(`${t('admin.treeRefreshError')}: ${requestError(apiError)}`);
      return false;
    } finally { if (initial) setLoading(false); }
  }, [appError, organizationId, t]);

  useEffect(() => {
    setTaxonomy(null); setLoadError(null); setMutationError(''); setCatalogWarning(''); setSelection({}); setName(''); setSlug('');
    void reload(true);
  }, [organizationId, reload]);

  const selectedCategory = taxonomy?.find((item) => item.id === selection.categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find((item) => item.id === selection.subcategoryId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true); setMutationError(''); setCatalogWarning('');
    try {
      const input = { name: { es: name.trim(), en: name.trim() }, ...(slug.trim() ? { slug: slug.trim() } : {}) };
      if (form === 'category') {
        const category = await createCategory(organizationId, input);
        setSelection({ categoryId: category.id });
      } else if (form === 'subcategory') {
        if (!selection.categoryId) return;
        const subcategory = await createSubcategory(organizationId, selection.categoryId, input);
        setSelection({ categoryId: selection.categoryId, subcategoryId: subcategory.id });
      } else {
        if (!selection.categoryId || !selection.subcategoryId) return;
        await createPanel(organizationId, selection.subcategoryId, input);
      }
      setName(''); setSlug('');
      await reload();
      try {
        await refreshCatalog();
      } catch (catalogError) {
        // The management tree is the authoritative post-write view. A separate
        // reader-navigation refresh cannot turn a successful create into failure.
        setCatalogWarning(`${t('admin.catalogRefreshWarning')}: ${requestError(catalogError)}`);
      }
    } catch (next) {
      const apiError = next instanceof ApiError ? next : new ApiError(0, requestError(next));
      if (apiError.status === 401) appError?.classifyAndRaise(apiError);
      if (apiError.status === 401 || apiError.status === 403 || apiError.status === 404) setLoadError(apiError);
      else setMutationError(requestError(apiError));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-text-muted"><CircleNotch className="mr-2 h-4 w-4 animate-spin" />{t('admin.loading')}</div>;
  if (loadError) {
    const protectedState = loadError.status === 401 || loadError.status === 403 || loadError.status === 404;
    return <div className="p-6"><EmptyState icon={protectedState ? ShieldCheck : WarningCircle} title={t(protectedState ? 'admin.unavailableTitle' : 'admin.errorTitle')} body={protectedState ? t('admin.unavailableBody') : requestError(loadError)} action={<button type="button" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-hover" onClick={() => void reload(true)}>{t('admin.retry')}</button>} /></div>;
  }

  const canCreateSubcategory = Boolean(selection.categoryId);
  const canCreatePanel = Boolean(selection.categoryId && selection.subcategoryId);
  const formEnabled = form === 'category' || (form === 'subcategory' ? canCreateSubcategory : canCreatePanel);
  const tree = taxonomy ?? [];

  return <main className="h-full overflow-auto p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('admin.eyebrow')}</p><h1 className="mt-1 font-display text-2xl font-semibold">{t('admin.title')}</h1><p className="mt-1 max-w-2xl text-sm text-text-secondary">{t('admin.description')}</p></div><button type="button" onClick={() => void reload()} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-hover">{t('admin.refresh')}</button></header>
    {mutationError && <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{mutationError}</p>}
    {catalogWarning && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">{catalogWarning}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2"><Stack className="h-4 w-4 text-accent" /><h2 className="font-medium">{t('admin.taxonomy')}</h2></div>
        <div className="space-y-2">
          {tree.length === 0 ? <EmptyState icon={FolderPlus} title={t('admin.emptyTitle')} body={t('admin.emptyBody')} /> : tree.map((category) => (
            <div key={category.id} className="rounded-lg border border-border">
              <button type="button" onClick={() => setSelection({ categoryId: category.id })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover"><FolderPlus className="h-4 w-4 text-accent" /><span className="min-w-0 flex-1 truncate font-medium">{localName(category.name, locale)}</span><code className="text-xs text-text-muted">/{category.slug}</code><CaretRight className="h-4 w-4 text-text-muted" /></button>
              <div className="border-t border-border px-3 py-2">
                {category.subcategories.map((subcategory) => (
                  <div key={subcategory.id}>
                    <button type="button" onClick={() => setSelection({ categoryId: category.id, subcategoryId: subcategory.id })} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-hover"><span className="w-4" /><FileText className="h-3.5 w-3.5 text-text-muted" /><span className="min-w-0 flex-1 truncate">{localName(subcategory.name, locale)}</span><code className="text-xs text-text-muted">/{subcategory.slug}</code></button>
                    {subcategory.panels.map((panel) => <button type="button" key={panel.id} onClick={() => setSelection({ categoryId: category.id, subcategoryId: subcategory.id, panelId: panel.id })} className={`ml-10 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-hover ${panel.status === 'ARCHIVED' ? 'text-text-muted' : 'text-text-secondary'}`}><span className={`h-1.5 w-1.5 rounded-full ${panel.status === 'PUBLISHED' ? 'bg-emerald-500' : panel.status === 'DRAFT' ? 'bg-amber-500' : 'bg-text-muted'}`} /><span className="min-w-0 flex-1 truncate">{localName(panel.name, locale)}</span><span className={`rounded px-1.5 py-0.5 ${panelStatusClass(panel.status)}`}>{panel.status}</span></button>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    <aside>{selection.panelId ? <PanelEditor key={selection.panelId} organizationId={organizationId} panelId={selection.panelId} /> : <div className="rounded-xl border border-border bg-surface p-4 md:p-5"><div className="mb-4"><p className="text-sm font-medium">{t('admin.createTitle')}</p><p className="mt-1 text-xs text-text-muted">{t('admin.createHint')}</p></div><div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-surface-hover p-1">{(['category', 'subcategory', 'panel'] as const).map((kind) => <button key={kind} type="button" onClick={() => setForm(kind)} className={`rounded-md px-2 py-1.5 text-xs font-medium ${form === kind ? 'bg-surface text-text shadow-soft' : 'text-text-muted hover:text-text'}`}>{t(`admin.form.${kind}`)}</button>)}</div><form onSubmit={submit} className="space-y-3"><p className="rounded-md bg-surface-hover px-3 py-2 text-xs text-text-secondary">{form === 'category' ? t('admin.target.organization') : form === 'subcategory' ? (selectedCategory ? localName(selectedCategory.name, locale) : t('admin.target.category')) : (selectedSubcategory ? localName(selectedSubcategory.name, locale) : t('admin.target.subcategory'))}</p><label className="block text-xs font-medium"><span>{t('admin.name')}</span><input required value={name} onChange={(event) => setName(event.target.value)} maxLength={500} disabled={!formEnabled || saving} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent disabled:opacity-50" /></label><label className="block text-xs font-medium"><span>{t('admin.slug')}</span><input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={100} disabled={!formEnabled || saving} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent disabled:opacity-50" /><span className="mt-1 block text-text-muted">{t('admin.slugHint')}</span></label><button type="submit" disabled={!formEnabled || saving || !name.trim()} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? t('admin.saving') : t('admin.create')}</button>{!formEnabled && <p className="text-xs text-text-muted">{form === 'subcategory' ? t('admin.selectCategory') : t('admin.selectSubcategory')}</p>}</form></div>}</aside></div>
  </div></main>;
}
