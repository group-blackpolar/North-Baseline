import { useState, type FormEvent } from 'react';
import { Eye, EyeSlash, MagicWand } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/context/NotificationContext';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { createPlatformUser, type PlatformUser } from '@/lib/platformAdmin';
import { selectClass } from '../../documents/shared';

const ROLES = ['ADMIN', 'DEVELOPER', 'USER'] as const;
const MIN = 12;
const MAX = 128;

/** `BP-Admin-` + 40 random letters/digits (unbiased, from crypto.getRandomValues): 49 characters, well inside 12-128. */
const PASSWORD_PREFIX = 'BP-Admin-';
function generatePassword() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  while (out.length < 40) {
    for (const byte of crypto.getRandomValues(new Uint8Array(64))) {
      if (byte < 248 && out.length < 40) out += alphabet[byte % alphabet.length]; // 248 = 62 * 4: no modulo bias
    }
  }
  return PASSWORD_PREFIX + out;
}

/**
 * Superadmin-only: create an account with a login (email-shaped) and a password the superadmin assigns.
 * The account is created already verified (no email, no code). The password is sent once to CORECROW over
 * HTTPS and is never stored or shown again here; CORECROW only keeps a hash.
 */
export function CreateAccountDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (user: PlatformUser) => void }) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('ADMIN');
  const [changeRequired, setChangeRequired] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(''); setEmail(''); setPassword(''); setRole('ADMIN'); setChangeRequired(true); setShow(false); setError(null); };
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return setError(t('pa.create.invalidName'));
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('pa.create.invalidEmail'));
    if (password.length < MIN || password.length > MAX) return setError(t('pa.create.invalidPassword', { min: MIN, max: MAX }));
    setBusy(true); setError(null);
    try {
      const user = await createPlatformUser({ name: name.trim(), email: email.trim(), password, role, passwordChangeRequired: changeRequired });
      push({ type: 'success', title: t('pa.create.done'), body: user.email });
      onCreated(user);
      close(false);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'IDENTITY_EXISTS' ? t('pa.create.exists') : reason instanceof Error ? reason.message : t('pa.create.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close} title={t('pa.create.title')} description={t('pa.create.description')}
      footer={<><Button variant="ghost" onClick={() => close(false)} disabled={busy}>{t('pa.close')}</Button><Button variant="primary" type="submit" form="create-account-form" loading={busy}>{t('pa.create.submit')}</Button></>}>
      <form id="create-account-form" onSubmit={(event) => void submit(event)} className="space-y-3" autoComplete="off">
        <label className="block space-y-1"><span className="ui-label">{t('pa.col.name')}</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></label>
        <label className="block space-y-1"><span className="ui-label">{t('pa.create.login')}</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="soporte@blackpolar.local" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
          <span className="block text-[11px] text-text-muted">{t('pa.create.loginHint')}</span>
        </label>
        <div className="space-y-1">
          <label htmlFor="create-account-password" className="ui-label">{t('pa.create.password')}</label>
          <div className="flex gap-2">
            <Input id="create-account-password" type={show ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="flex-1" />
            <Button type="button" variant="outline" size="icon" aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')} onClick={() => setShow((value) => !value)}><Icon icon={show ? EyeSlash : Eye} size="sm" /></Button>
            <Button type="button" variant="outline" size="icon" aria-label={t('pa.create.generate')} title={t('pa.create.generate')} onClick={() => { setPassword(generatePassword()); setShow(true); }}><Icon icon={MagicWand} size="sm" /></Button>
          </div>
          <span className="block text-[11px] text-text-muted">{t('pa.create.passwordHint', { min: MIN })}</span>
        </div>
        <label className="block space-y-1"><span className="ui-label">{t('pa.col.role')}</span>
          <select className={`${selectClass} w-full`} value={role} onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}>{ROLES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="flex items-start gap-2 text-xs text-text-secondary pointer-coarse:min-h-(--touch-min)"><input type="checkbox" className="mt-0.5" checked={changeRequired} onChange={(event) => setChangeRequired(event.target.checked)} /><span>{t('pa.create.changeRequired')}</span></label>
        <p className="rounded-md bg-accent-soft px-3 py-2 text-xs text-text-secondary">{t('pa.create.verifiedNote')}</p>
        {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
      </form>
    </Dialog>
  );
}
