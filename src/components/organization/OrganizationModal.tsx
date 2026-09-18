import { useRef, useState } from 'react';
import { ArrowLeft, Building2, Copy, KeyRound, RefreshCw, Share2, Upload, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createDemoOrganization, generateInviteToken, initialsFor, joinDemoOrganization } from '@/lib/demo/store';

type Mode = 'choose' | 'create' | 'join' | 'created';

export function OrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { refresh, switchOrganization } = useOrganization();
  const { push } = useNotifications();
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => { setMode('choose'); setName(''); setDescription(''); setAvatarUrl(null); setToken(''); setJoinValue(''); setError(''); };

  const handleCreate = () => {
    if (!name.trim()) { setError(t('org.create.nameRequired')); return; }
    // TODO: CoreCrow Organization + Invitation API
    const result = createDemoOrganization({ name: name.trim(), description: description.trim() || undefined, avatarUrl });
    setToken(result.token);
    setMode('created');
    void refresh().then(() => switchOrganization(result.org.id));
    push({ type: 'success', title: t('org.create.success'), body: result.org.name });
  };

  const handleJoin = () => {
    try {
      // TODO: CoreCrow Invitation accept API (+ URLs /invite/{token})
      const result = joinDemoOrganization(joinValue);
      void refresh().then(() => switchOrganization(result.org.id));
      push({ type: 'success', title: t('org.join.success', { name: result.org.name }) });
      reset(); onClose();
    } catch {
      setError(t('org.join.invalid'));
    }
  };

  const copyToken = async () => {
    await navigator.clipboard.writeText(token).catch(() => {});
    push({ type: 'info', title: t('org.create.copy'), body: token });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="np-card w-full max-w-md p-6 space-y-5 shadow-pop" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode !== 'choose' && (
              <button type="button" aria-label={t('org.back')} className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150" onClick={() => { setMode('choose'); setError(''); }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display text-lg font-semibold text-text">{t('org.modal.title')}</h2>
          </div>
          <button type="button" aria-label="Close" className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-150" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </header>

        {mode === 'choose' && (
          <div className="grid grid-cols-1 gap-3">
            <button type="button" className="np-card p-4 flex items-center gap-3 text-left hover:bg-surface-hover transition-colors duration-150" onClick={() => setMode('create')}>
              <div className="size-10 rounded-xl bg-accent-soft flex items-center justify-center"><Building2 className="w-5 h-4 text-accent" /></div>
              <div><p className="text-sm font-semibold text-text">{t('org.create')}</p><p className="text-xs text-text-secondary">{t('org.createHint')}</p></div>
            </button>
            <button type="button" className="np-card p-4 flex items-center gap-3 text-left hover:bg-surface-hover transition-colors duration-150" onClick={() => setMode('join')}>
              <div className="size-10 rounded-xl bg-surface-active flex items-center justify-center"><KeyRound className="w-5 h-5 text-text-secondary" /></div>
              <div><p className="text-sm font-semibold text-text">{t('org.join')}</p><p className="text-xs text-text-secondary">{t('org.joinHint')}</p></div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button type="button" className="size-16 rounded-xl border border-dashed border-border-strong bg-surface-hover/50 overflow-hidden flex items-center justify-center text-text-muted hover:border-accent hover:text-accent transition-colors duration-150 shrink-0" onClick={() => fileRef.current?.click()}>
                {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : name.trim() ? <span className="font-display text-lg font-semibold">{initialsFor(name)}</span> : <Upload className="w-5 h-5" />}
              </button>
              <div className="text-xs text-text-secondary space-y-0.5">
                <p className="font-medium text-text">{t('org.create.icon')}</p>
                <p>{t('org.create.iconHint')}</p>
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : null);
                reader.readAsDataURL(file);
              }} />
            </div>
            <div className="space-y-1.5">
              <label className="ui-label block">{t('org.create.name')}</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shark Maritime" />
            </div>
            <div className="space-y-1.5">
              <label className="ui-label block">{t('org.create.description')}</label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <Button variant="primary" className="w-full" onClick={handleCreate}>{t('org.create.submit')}</Button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ui-label block">{t('org.join.title')}</label>
              <Input value={joinValue} onChange={(event) => { setJoinValue(event.target.value); setError(''); }} placeholder={t('org.join.placeholder')} className="mono-data" />
              <p className="text-xs text-text-muted">{t('org.join.urlsHint')}</p>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <Button variant="primary" className="w-full" onClick={handleJoin}>{t('org.join.submit')}</Button>
          </div>
        )}

        {mode === 'created' && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{t('org.create.tokenHint')}</p>
            <div className="rounded-lg border border-border bg-surface-hover/60 px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="mono-data text-sm text-text">{token}</span>
              <div className="flex items-center gap-1">
                <button type="button" title={t('org.create.copy')} className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-active hover:text-text transition-colors duration-150" onClick={() => void copyToken()}><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" title={t('org.create.regenerate')} className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-active hover:text-text transition-colors duration-150" onClick={() => setToken(generateInviteToken(initialsFor(name) || 'NORTH'))}><RefreshCw className="w-3.5 h-3.5" /></button>
                <button type="button" title={t('org.create.share')} className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-active hover:text-text transition-colors duration-150" onClick={() => void copyToken()}><Share2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={() => { reset(); onClose(); }}>{t('org.create.done')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}