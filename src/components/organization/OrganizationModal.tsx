import { useState } from 'react';
import { ArrowLeft, Building2, KeyRound, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotifications } from '@/context/NotificationContext';
import { acceptInvitation, createOrganization } from '@/lib/organizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pushPath } from '@/lib/routes';

type Mode = 'choose' | 'create' | 'join';

/** Tenant creation and membership always go through CORECROW. */
export function OrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n(); const { refresh, switchOrganization } = useOrganization(); const { push } = useNotifications();
  const [mode, setMode] = useState<Mode>('choose'); const [name, setName] = useState(''); const [slug, setSlug] = useState('');
  const [token, setToken] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (!open) return null;
  const reset = () => { setMode('choose'); setName(''); setSlug(''); setToken(''); setError(''); };
  const select = async (id: string, targetSlug?: string) => { const organizations = await refresh(); if (organizations.some((organization) => organization.id === id)) switchOrganization(id); if (targetSlug) pushPath(`/${encodeURIComponent(targetSlug)}`); };
  const handleCreate = async () => {
    if (!name.trim()) { setError(t('org.create.nameRequired')); return; } setBusy(true); setError('');
    try { const org = await createOrganization({ name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}) }); await select(org.id, org.slug); push({ type: 'success', title: t('org.create.success'), body: org.name }); reset(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('org.create.failed')); } finally { setBusy(false); }
  };
  const handleJoin = async () => {
    if (!token.trim()) { setError(t('org.join.invalid')); return; } setBusy(true); setError('');
    try { const member = await acceptInvitation(token.trim()) as { organizationId: string }; await select(member.organizationId); push({ type: 'success', title: t('org.join.success', { name: '' }) }); reset(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('org.join.invalid')); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4" onClick={onClose}>
    <div className="np-card w-full max-w-md space-y-5 p-6 shadow-pop" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between"><div className="flex items-center gap-2">{mode !== 'choose' && <button type="button" aria-label={t('org.back')} onClick={() => { setMode('choose'); setError(''); }}><ArrowLeft className="w-4 h-4" /></button>}<h2 className="font-display text-lg font-semibold text-text">{t('org.modal.title')}</h2></div><button type="button" aria-label="Close" onClick={onClose}><X className="w-4 h-4" /></button></header>
      {mode === 'choose' && <div className="grid gap-3"><button type="button" className="np-card flex items-center gap-3 p-4 text-left hover:bg-surface-hover" onClick={() => setMode('create')}><Building2 className="w-5 h-5 text-accent" /><div><p className="text-sm font-semibold">{t('org.create')}</p><p className="text-xs text-text-secondary">{t('org.createHint')}</p></div></button><button type="button" className="np-card flex items-center gap-3 p-4 text-left hover:bg-surface-hover" onClick={() => setMode('join')}><KeyRound className="w-5 h-5" /><div><p className="text-sm font-semibold">{t('org.join')}</p><p className="text-xs text-text-secondary">{t('org.joinHint')}</p></div></button></div>}
      {mode === 'create' && <div className="space-y-4"><label className="ui-label block">{t('org.create.name')}<Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="ui-label block">{t('org.create.slug')}<Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="my-organization" /></label>{error && <p role="alert" className="text-xs text-error">{error}</p>}<Button variant="primary" className="w-full" disabled={busy} onClick={() => void handleCreate()}>{busy ? '…' : t('org.create.submit')}</Button></div>}
      {mode === 'join' && <div className="space-y-4"><label className="ui-label block">{t('org.join.title')}<Input value={token} onChange={(event) => { setToken(event.target.value); setError(''); }} autoComplete="off" /></label>{error && <p role="alert" className="text-xs text-error">{error}</p>}<Button variant="primary" className="w-full" disabled={busy} onClick={() => void handleJoin()}>{busy ? '…' : t('org.join.submit')}</Button></div>}
    </div>
  </div>;
}
