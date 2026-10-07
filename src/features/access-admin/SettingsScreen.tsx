import { useRef, useState, type FormEvent } from 'react';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/context/NotificationContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { PERM } from '@/lib/permission';
import { getOrganizations, updateOrganization } from '@/lib/organizations';
import { LoadError, Loading, Notice, Shell, errorText, useList } from './ui';

const ICON_SIDE = 512;
const ICON_MAX_BYTES = 256 * 1024;

/** Scales any image to fit 512x512 and encodes it as WebP (PNG fallback) so it satisfies the server limits. */
async function toIconData(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, ICON_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.9, 0.75, 0.6]) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.startsWith('data:image/webp') && (url.length * 3) / 4 <= ICON_MAX_BYTES) return url;
  }
  const png = canvas.toDataURL('image/png');
  if ((png.length * 3) / 4 > ICON_MAX_BYTES) throw new Error('too-big');
  return png;
}

/** General organization settings only: identity (icon, name, slug). Structure lives under Architecture. */
export function SettingsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const { refresh } = useOrganization();
  const { push } = useNotifications();
  const canEdit = can(PERM.organizationUpdate);
  const current = useList(async () => (await getOrganizations()).find((item) => item.id === organizationId) ?? null, [organizationId]);
  const [draft, setDraft] = useState<{ name: string; slug: string; icon: string | null; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const organization = current.data;
  const form = draft ?? (organization ? { name: organization.name, slug: organization.slug ?? '', icon: organization.iconData ?? null, description: organization.description ?? '' } : null);
  const dirty = Boolean(draft && organization && (draft.name !== organization.name || draft.slug !== (organization.slug ?? '') || draft.icon !== (organization.iconData ?? null) || draft.description !== (organization.description ?? '')));

  const pick = async (selected: File | undefined) => {
    if (!selected || !form) return;
    setError(null);
    if (!/^image\/(png|jpeg|webp)$/.test(selected.type)) { setError(t('adm.settings.iconInvalid')); return; }
    try { setDraft({ ...form, icon: await toIconData(selected) }); }
    catch { setError(t('adm.settings.iconTooBig')); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!organization || !draft) return;
    setBusy(true); setError(null);
    try {
      await updateOrganization(organizationId, {
        ...(draft.name !== organization.name ? { name: draft.name.trim() } : {}),
        ...(draft.slug !== (organization.slug ?? '') ? { slug: draft.slug.trim() } : {}),
        ...(draft.icon !== (organization.iconData ?? null) ? { iconData: draft.icon } : {}),
        ...(draft.description !== (organization.description ?? '') ? { description: draft.description.trim() || null } : {}),
      });
      push({ type: 'success', title: t('adm.settings.saved') });
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
              <OrganizationAvatar name={form.name} iconData={form.icon} className="size-24 text-2xl" />
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ''; }} />
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={!canEdit || busy} onClick={() => file.current?.click()}><UploadSimple className="size-4" />{t('adm.settings.upload')}</Button>
                {form.icon && <Button size="icon-sm" variant="ghost" aria-label={t('adm.settings.remove')} title={t('adm.settings.remove')} disabled={!canEdit || busy} onClick={() => setDraft({ ...form, icon: null })}><Trash className="size-4" /></Button>}
              </div>
              <p className="max-w-56 text-[11px] text-text-muted">{t('adm.settings.iconHint')}</p>
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
