import { Building2, KeyRound, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface PublicOrganization {
  name: string;
  slug: string;
}

export function OrganizationAccessGate({
  organization,
  authenticated,
  onSignIn,
  onCreateAccount,
  onAcceptInvitation,
  accepting = false,
  error = '',
  initialToken = '',
}: {
  organization: PublicOrganization;
  authenticated: boolean;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onAcceptInvitation: (token: string) => Promise<void>;
  accepting?: boolean;
  error?: string;
  initialToken?: string;
}) {
  const { t } = useI18n();
  const [token, setToken] = useState(initialToken);
  useEffect(() => { if (initialToken) setToken(initialToken); }, [initialToken]);
  // CoreCrow owns invitation format validation (email credentials and BP codes
  // have different shapes). The client only bounds input safely.
  const valid = token.trim().length >= 8 && token.trim().length <= 128;
  return (
    <main className="min-h-screen bg-background p-4 text-text sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
        <section aria-labelledby="organization-access-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Building2 aria-hidden="true" /></div><div><p className="ui-label">NORTH</p><h1 id="organization-access-title" className="font-display text-xl font-semibold">{organization.name}</h1></div></div>
          <p className="text-sm leading-6 text-text-secondary">{t('org.access.body')}</p>
          {!authenticated && <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={onSignIn} className="north-primary flex h-10 items-center justify-center gap-2 rounded-lg bg-black text-sm font-medium text-white"><LogIn className="size-4" />{t('org.access.signIn')}</button><button type="button" onClick={onCreateAccount} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover"><UserPlus className="size-4" />{t('org.access.create')}</button></div>}
          <form className="mt-6 border-t border-border pt-5" onSubmit={(event) => { event.preventDefault(); if (valid) void onAcceptInvitation(token.trim()); }}>
            <label htmlFor="organization-invitation" className="block text-sm font-medium">{t('org.access.invitation')}</label>
            <p className="mt-1 text-xs leading-5 text-text-muted">{t('org.access.invitationHint')}</p>
            {authenticated && initialToken && <p className="mt-3 text-xs text-text-secondary">{t('org.access.confirmation')}</p>}
            <div className="mt-3 flex gap-2"><input id="organization-invitation" value={token} onChange={(event) => setToken(event.target.value.replace(/\s/g, ''))} autoComplete="off" maxLength={128} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25" /><button type="submit" disabled={!valid || accepting} className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"><KeyRound className="size-4" />{accepting ? '…' : authenticated ? t('org.access.accept') : t('org.access.enter')}</button></div>
            {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}

export function GenericNotFound() {
  const { t } = useI18n();
  return <main className="min-h-screen bg-background p-6 text-text"><div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center"><section className="w-full rounded-2xl border border-border bg-surface p-8 text-center shadow-soft"><h1 className="font-display text-xl font-semibold">{t('org.notFound.title')}</h1><p className="mt-3 text-sm leading-6 text-text-secondary">{t('org.notFound.body')}</p></section></div></main>;
}
