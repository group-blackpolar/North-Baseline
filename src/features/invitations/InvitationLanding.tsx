import { useEffect, useState, type FormEvent } from 'react';
import { Envelope, Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { login, type SessionUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { clearSessionKilled } from '@/lib/sessionCleanup';
import { validateInvitation, type InvitationPreview } from '@/lib/invitationKey';
import { acceptInvitation } from '@/lib/organizations';

const MIN_PASSWORD = 12;

/**
 * Where the link of an invitation email lands (`/?invitation=<token>`). One screen for every case:
 * - signed in with the invited address -> a single "Accept" button;
 * - not signed in and the address already has an account -> sign in, then accept;
 * - the address has no account -> choose a name and a password; the account is created already verified and joins at once.
 * The token never leaves this component except in the CORECROW calls; the page URL is replaced on exit.
 */
export function InvitationLanding({ token, user, onSignIn, onLogout }: { token: string; user: SessionUser | null; onSignIn: () => void; onLogout: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'invalid' } | { status: 'ready'; preview: InvitationPreview }>({ status: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    validateInvitation(token)
      .then((preview) => { if (live) setState({ status: 'ready', preview }); })
      .catch(() => { if (live) setState({ status: 'invalid' }); });
    return () => { live = false; };
  }, [token]);

  const finish = (slug: string) => window.location.replace(`/${slug}`);
  const goHome = () => window.location.replace('/');

  const accept = async (slug: string) => {
    setBusy(true); setError('');
    try { await acceptInvitation(token); finish(slug); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('inv.failed')); setBusy(false); }
  };

  const create = async (event: FormEvent, preview: InvitationPreview) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError(t('inv.nameRequired')); return; }
    if (password.length < MIN_PASSWORD) { setError(t('inv.passwordShort', { n: MIN_PASSWORD })); return; }
    setBusy(true); setError('');
    try {
      await apiRequest('/v1/invitations/accept-new', { method: 'POST', body: JSON.stringify({ token, name: name.trim(), password }) });
      await login(preview.email ?? '', password);
      clearSessionKilled(); // a previous sign-out leaves the kill-switch on; signing in again lifts it
      finish(preview.organization.slug);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('inv.failed')); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-auto bg-background p-6 text-text">
      <div className="np-card w-full max-w-md space-y-5 p-6">
        {state.status === 'loading' ? <div className="space-y-3" aria-busy="true"><Skeleton className="h-12 w-12 rounded-xl" /><Skeleton className="h-5 w-48" /><Skeleton className="h-9 w-full" /></div> : null}

        {state.status === 'invalid' ? (
          <div className="space-y-4 text-center" role="alert">
            <WarningCircle className="mx-auto size-10 text-error" aria-hidden="true" />
            <h1 className="font-display text-lg font-semibold">{t('inv.invalidTitle')}</h1>
            <p className="text-sm text-text-secondary">{t('inv.invalidBody')}</p>
            <Button variant="primary" className="w-full" onClick={goHome}>{t('inv.goHome')}</Button>
          </div>
        ) : null}

        {state.status === 'ready' ? (() => {
          const { preview } = state;
          const invited = preview.email ?? '';
          const matches = Boolean(user && invited && user.email.toLowerCase() === invited.toLowerCase());
          return (
            <>
              <div className="flex items-center gap-3">
                <OrganizationAvatar name={preview.organization.name} iconData={preview.organization.iconData} className="size-12" />
                <div className="min-w-0">
                  <h1 className="truncate font-display text-lg font-semibold">{t('inv.title', { name: preview.organization.name })}</h1>
                  {invited ? <p className="flex items-center gap-1 truncate text-xs text-text-secondary"><Envelope className="size-3.5 shrink-0" aria-hidden="true" />{invited}</p> : null}
                </div>
              </div>

              {user && !matches && preview.kind === 'EMAIL' ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">{t('inv.wrongAccount', { email: invited, current: user.email })}</p>
                  <Button variant="primary" className="w-full" onClick={onLogout}>{t('inv.switchAccount')}</Button>
                </div>
              ) : user ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">{t('inv.acceptBody', { name: preview.organization.name })}</p>
                  {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
                  <Button variant="accent" className="w-full" loading={busy} onClick={() => void accept(preview.organization.slug)}>{t('inv.accept')}</Button>
                </div>
              ) : preview.accountExists ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">{t('inv.existingAccount', { email: invited })}</p>
                  <Button variant="accent" className="w-full" onClick={onSignIn}>{t('inv.signIn')}</Button>
                </div>
              ) : preview.kind === 'EMAIL' ? (
                <form className="space-y-3" onSubmit={(event) => void create(event, preview)}>
                  <p className="text-sm text-text-secondary">{t('inv.newAccount')}</p>
                  <label className="ui-label block">{t('inv.name')}<Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus maxLength={120} /></label>
                  <label className="ui-label block">{t('inv.password')}
                    <span className="relative block">
                      <Input type={reveal ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" maxLength={128} className="pr-9" />
                      <button type="button" onClick={() => setReveal((value) => !value)} aria-label={reveal ? t('inv.hide') : t('inv.show')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                        {reveal ? <EyeSlash className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                      </button>
                    </span>
                    <span className="mt-1 block text-[0.7rem] font-normal text-text-muted">{t('inv.passwordHint', { n: MIN_PASSWORD })}</span>
                  </label>
                  {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
                  <Button type="submit" variant="accent" className="w-full" loading={busy}>{t('inv.createAndJoin')}</Button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">{t('inv.keyBody')}</p>
                  <Button variant="accent" className="w-full" onClick={onSignIn}>{t('inv.signIn')}</Button>
                </div>
              )}
              <button type="button" onClick={goHome} className="block w-full text-center text-xs text-text-muted hover:text-text">{t('inv.notNow')}</button>
            </>
          );
        })() : null}
      </div>
    </div>
  );
}
