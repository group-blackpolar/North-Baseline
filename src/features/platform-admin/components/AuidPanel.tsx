import { useEffect, useState } from 'react';
import { ArrowsClockwise, Copy, Eye, EyeSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/context/NotificationContext';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getAuidState, regenerateAuid, revealAuid } from '@/lib/platformAdmin';
import { useResource } from '../resource';

type Mode = 'reveal' | 'regenerate';

/**
 * Admin Unique ID (AUID) of an ADMIN/SUPERADMIN. Reveal and Regenerate are SUPERADMIN-only and need the actor's own
 * password, verified by CORECROW. The revealed value and the typed password live only in this component's memory:
 * they are dropped on Hide, on closing the dialog, when the user changes, and when the screen unmounts.
 * Nothing is written to storage, the URL or logs.
 */
export function AuidPanel({ userId, canManage }: { userId: string; canManage: boolean }) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const state = useResource(() => getAuidState(userId), [userId]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  useEffect(() => { setShown(null); setPassword(''); setError(null); setMode(null); }, [userId]);
  useEffect(() => {
    const wipe = () => { setShown(null); setPassword(''); };
    window.addEventListener('pagehide', wipe);
    return () => { window.removeEventListener('pagehide', wipe); wipe(); };
  }, []);

  const close = () => { setMode(null); setPassword(''); setError(null); };
  const submit = async () => {
    if (!mode || !password) return;
    setBusy(true); setError(null);
    try {
      const result = await (mode === 'reveal' ? revealAuid : regenerateAuid)(userId, password);
      setShown(result.auid); setFresh(mode === 'regenerate');
      if (mode === 'regenerate') { push({ type: 'success', title: t('adm.auid.regenerated') }); state.reload(); }
      close();
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'REAUTHENTICATION_FAILED' ? t('adm.auid.reauthFailed')
        : reason instanceof ApiError && reason.code === 'AUID_ENCRYPTION_UNAVAILABLE' ? t('adm.auid.unavailable')
        : reason instanceof ApiError && reason.status === 429 ? t('adm.auid.tooMany')
        : reason instanceof Error ? reason.message : 'Request failed');
    } finally { setBusy(false); setPassword(''); }
  };
  const copy = async () => {
    if (!shown) return;
    try { await navigator.clipboard.writeText(shown); push({ type: 'success', title: t('adm.keys.copied') }); } catch { /* clipboard blocked */ }
  };

  const info = state.data;
  const legacy = Boolean(info?.configured && !info.revealable);
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="ui-label">{t('adm.auid.title')}</p><p className="text-xs text-text-secondary">{t('adm.auid.hint')}</p></div>
        {state.status === 'ready' && <span className={info?.configured ? 'text-xs text-success' : 'text-xs text-text-muted'}>{info?.configured ? t('adm.auid.configured') : t('adm.auid.missing')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-surface-hover px-2 py-1.5 font-mono text-sm" aria-label="AUID">{shown ?? '••••••••••••••••••••'}</code>
        {shown ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => void copy()}><Copy className="size-4" />{t('adm.auid.copy')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShown(null)}><EyeSlash className="size-4" />{t('adm.auid.hide')}</Button>
          </>
        ) : canManage && (
          <Button size="sm" variant="ghost" disabled={!info?.revealable} aria-label={t('adm.auid.show')} title={t('adm.auid.show')} onClick={() => setMode('reveal')}><Eye className="size-4" />{t('adm.auid.show')}</Button>
        )}
        {canManage && <Button size="sm" variant="outline" disabled={state.status !== 'ready' || info?.encryptionAvailable === false} onClick={() => setMode('regenerate')}><ArrowsClockwise className="size-4" />{t('adm.auid.regenerate')}</Button>}
      </div>
      {legacy && <div role="note" className="rounded-md bg-surface-hover px-2 py-1.5 text-xs text-text-secondary"><p className="font-medium text-text">{t('adm.auid.legacyTitle')}</p><p>{t('adm.auid.legacyBody')}</p></div>}
      {canManage && info && !info.encryptionAvailable && <p role="alert" className="text-xs text-warning">{t('adm.auid.unavailable')}</p>}
      {shown && fresh && <p role="status" className="text-xs text-warning">{t('adm.auid.once')}</p>}
      <ConfirmDialog open={mode !== null} destructive={mode === 'regenerate'} busy={busy} disabled={!password}
        title={mode === 'reveal' ? t('adm.auid.revealTitle') : t('adm.auid.confirmTitle')}
        description={mode === 'reveal' ? t('adm.auid.revealBody') : t('adm.auid.confirmBody')}
        confirmLabel={mode === 'reveal' ? t('adm.auid.reveal') : t('adm.auid.regenerate')} error={error}
        onCancel={close} onConfirm={() => void submit()}>
        <label className="block space-y-1"><span className="ui-label">{t('adm.auid.password')}</span><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && password && !busy) void submit(); }} /></label>
      </ConfirmDialog>
    </div>
  );
}
