import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { NorthMediaPicker } from '@/components/media-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteAsset, uploadAsset } from '@/lib/assets';
import { useNotifications } from '@/context/NotificationContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { PERM } from '@/lib/permission';
import { getOrganizations, updateOrganization } from '@/lib/organizations';
import { LoadError, Loading, Notice, Shell, errorText, useList } from './ui';
import { blobToDataUrl, toIconBlob } from './orgIcon';

/** General organization settings only: identity (icon, name, slug). Structure lives under Architecture. */
export function SettingsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const { refresh } = useOrganization();
  const { push } = useNotifications();
  const canEdit = can(PERM.organizationUpdate);
  const current = useList(async () => (await getOrganizations()).find((item) => item.id === organizationId) ?? null, [organizationId]);
  type Draft = { name: string; slug: string; description: string; iconTouched: boolean; icon: string | null; assetId: string | null };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // An asset uploaded for an icon that is never saved would sit in the quota forever: it is deleted on replace, remove or leave.
  const pendingAsset = useRef<string | null>(null);
  const discardPending = () => {
    const id = pendingAsset.current;
    pendingAsset.current = null;
    if (id) void deleteAsset(organizationId, id).catch(() => undefined);
  };
  useEffect(() => discardPending, []); // eslint-disable-line

  const organization = current.data;
  const form: Draft | null = draft ?? (organization ? { name: organization.name, slug: organization.slug ?? '', description: organization.description ?? '', iconTouched: false, icon: null, assetId: null } : null);
  const dirty = Boolean(draft && organization && (draft.iconTouched || draft.name !== organization.name || draft.slug !== (organization.slug ?? '') || draft.description !== (organization.description ?? '')));
  const hasIcon = form ? (form.iconTouched ? form.icon !== null : Boolean(organization?.iconAssetId || organization?.iconData)) : false;

  /**
   * The picker validates and frames the image. It is shrunk to a small WebP and uploaded as a CORECROW asset; if CORECROW
   * cannot store assets yet (or the caller lacks the asset capability) the legacy validated data URL is used instead.
   */
  const pick = async (files: File[]) => {
    if (!form || !files[0]) return;
    setError(null);
    let blob: Blob;
    try { blob = await toIconBlob(files[0]); } catch { throw new Error(t('adm.settings.iconTooBig')); }
    const preview = await blobToDataUrl(blob);
    let assetId: string | null = null;
    try { assetId = (await uploadAsset(organizationId, new File([blob], `icon.${blob.type === 'image/png' ? 'png' : 'webp'}`, { type: blob.type }))).id; }
    catch (reason) { console.warn('Managed icon upload unavailable, using the legacy data URL', reason); }
    discardPending();
    pendingAsset.current = assetId;
    setDraft({ ...form, iconTouched: true, icon: preview, assetId });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!organization || !draft) return;
    setBusy(true); setError(null);
    try {
      await updateOrganization(organizationId, {
        ...(draft.name !== organization.name ? { name: draft.name.trim() } : {}),
        ...(draft.slug !== (organization.slug ?? '') ? { slug: draft.slug.trim() } : {}),
        ...(draft.iconTouched ? (draft.icon === null ? { iconData: null, iconAssetId: null } : draft.assetId ? { iconAssetId: draft.assetId } : { iconData: draft.icon }) : {}),
        ...(draft.description !== (organization.description ?? '') ? { description: draft.description.trim() || null } : {}),
      });
      push({ type: 'success', title: t('adm.settings.saved') });
      if (draft.iconTouched && organization.iconAssetId && organization.iconAssetId !== draft.assetId) void deleteAsset(organizationId, organization.iconAssetId).catch(() => undefined);
      pendingAsset.current = null; // now referenced by the organization
      setDraft(null);
      await Promise.all([current.reload(), refresh()]);
    } catch (reason) { setError(errorText(reason)); push({ type: 'error', title: errorText(reason) }); }
    finally { setBusy(false); }
  };

  return (
    <Shell title={t('adm.settings.title')} hint={t('adm.settings.hint')}>
      <LoadError list={current} />
      {current.loading && !current.data ? <Loading /> : form && (
        <DashboardCard title={t('adm.settings.identity')} description={canEdit ? undefined : t('access.readOnly')}>
          <form onSubmit={(event) => void save(event)} className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="ui-label">{t('adm.settings.icon')}</p>
              {form.iconTouched
                ? <OrganizationAvatar name={form.name} iconData={form.icon} className="size-24 text-2xl" />
                : <OrganizationAvatar name={form.name} iconData={organization?.iconData} organizationId={organizationId} iconAssetId={organization?.iconAssetId} className="size-24 text-2xl" />}
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={!canEdit || busy} onClick={() => setPicking(true)}><UploadSimple className="size-4" />{t('adm.settings.upload')}</Button>
                {hasIcon && <Button size="icon-sm" variant="ghost" aria-label={t('adm.settings.remove')} title={t('adm.settings.remove')} disabled={!canEdit || busy} onClick={() => { discardPending(); setDraft({ ...form, iconTouched: true, icon: null, assetId: null }); }}><Trash className="size-4" /></Button>}
              </div>
              <p className="max-w-56 text-[11px] text-text-muted">{t('adm.settings.iconHint')}</p>
              <NorthMediaPicker open={picking} onOpenChange={setPicking} mode="icon" title={t('adm.settings.icon')} onSelect={pick} />
            </div>
            <div className="min-w-0 space-y-3">
              <label className="block space-y-1"><span className="ui-label">{t('adm.settings.name')}</span><Input required minLength={2} maxLength={100} value={form.name} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...form, name: event.target.value })} /></label>
              <label className="block space-y-1"><span className="ui-label">{t('adm.settings.slug')}</span><Input required maxLength={100} value={form.slug} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...form, slug: event.target.value })} className="font-mono" /><span className="block text-[11px] text-text-muted">{t('adm.settings.slugHint')}</span></label>
              <label className="block space-y-1"><span className="ui-label">{t('adm.settings.description')}</span><textarea rows={3} maxLength={500} value={form.description} disabled={!canEdit || busy} onChange={(event) => setDraft({ ...form, description: event.target.value })} className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:border-accent disabled:opacity-50" /></label>
              {organization?.status && <p className="text-xs text-text-secondary"><span className="ui-label mr-2">{t('adm.settings.status')}</span>{organization.status}</p>}
              <div className="flex items-center gap-3"><Button type="submit" variant="accent" loading={busy} disabled={!canEdit || !dirty}>{t('adm.settings.save')}</Button><Notice error={error} /></div>
            </div>
          </form>
        </DashboardCard>
      )}
    </Shell>
  );
}
