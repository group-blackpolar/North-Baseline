import { useState } from 'react';
import { Fingerprint, KeyRound, Monitor, ShieldCheck, Smartphone, Laptop } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { personalService } from '../data/service';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const DEVICE_ICONS = { Desktop: Monitor, Laptop: Laptop, Mobile: Smartphone } as const;

function Field({ label, value, placeholder }: { label: string; value: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="ui-label block">{label}</label>
      <input
        defaultValue={value}
        placeholder={placeholder}
        className="w-full h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150"
      />
    </div>
  );
}

function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="ui-label pb-1">{label}</dt>
      <dd className={cn('text-sm text-text', mono && 'mono-data')}>{value}</dd>
    </div>
  );
}

export function ProfilePage({ sub, user }: { sub: string; user: SessionUser }) {
  const [twoFa, setTwoFa] = useState(false);
  const sessions = personalService.sessions();

  if (sub === 'account') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">Account</h1>
        <DashboardCard title="Account details" description="Identidad de tu cuenta en NORTH.">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ReadOnly label="EMAIL" value={user.email} />
            <ReadOnly label="ACCOUNT ID" value={user.id} mono />
            <ReadOnly label="CREATED" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} />
            <div>
              <dt className="ui-label pb-1">STATUS</dt>
              <dd>
                <span className="rounded-full bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1">
                  {user.emailVerified ? 'Active' : 'Pending verification'}
                </span>
              </dd>
            </div>
          </dl>
        </DashboardCard>
      </div>
    );
  }

  if (sub === 'contact') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">Contact information</h1>
        <DashboardCard title="Contact" description="Cómo podemos contactarte.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email" value={user.email} />
            <Field label="Phone (optional)" value="" placeholder="+507 6000 0000" />
          </div>
        </DashboardCard>
      </div>
    );
  }

  if (sub === 'security') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">Security</h1>
        <DashboardCard title="Password" description="Última actualización: hace 3 meses.">
          <button type="button" className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-text hover:bg-surface-hover transition-colors duration-150">
            Change password
          </button>
        </DashboardCard>
        <DashboardCard title="Two-factor authentication" description="Añade una capa extra de seguridad.">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-sm text-text">2FA via authenticator app</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={twoFa}
              onClick={() => setTwoFa((v) => !v)}
              className={cn(
                'h-5 w-9 rounded-full transition-colors duration-150 relative',
                twoFa ? 'bg-accent' : 'bg-surface-active'
              )}
            >
              <span className={cn('absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-150', twoFa ? 'left-4.5' : 'left-0.5')} />
            </button>
          </div>
          {/* TODO: CoreCrow Security — enrollment real de 2FA */}
        </DashboardCard>
        <DashboardCard title="Passkeys / security keys" description="Próximamente disponible con CoreCrow Security.">
          <div className="flex items-center gap-2.5 text-sm text-text-muted">
            <Fingerprint className="w-4 h-4" />
            Sin passkeys registradas
          </div>
        </DashboardCard>
      </div>
    );
  }

  if (sub === 'sessions') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">Sessions</h1>
        <DashboardCard title="Active sessions" description="Dispositivos con acceso a tu cuenta.">
          <ul className="space-y-2">
            {sessions.map((session) => {
              const Icon = DEVICE_ICONS[session.device as keyof typeof DEVICE_ICONS] ?? Monitor;
              return (
                <li key={session.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60">
                  <div className="size-9 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text font-medium truncate">
                      {session.device} · {session.browser} · {session.os}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {session.ip} · {session.location} · {session.lastActive}
                    </p>
                  </div>
                  {session.current ? (
                    <span className="rounded-full bg-accent-soft text-accent text-[10px] font-semibold px-2 py-0.5 shrink-0">Actual</span>
                  ) : (
                    <button type="button" className="text-xs text-text-muted hover:text-error transition-colors duration-150 shrink-0">
                      Revocar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {/* TODO: CoreCrow Sessions — listar/revocar reales */}
        </DashboardCard>
      </div>
    );
  }

  if (sub === 'connected-accounts') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">Connected accounts</h1>
        <DashboardCard title="Google" description="group.blackpolar@gmail.com">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1">Conectado</span>
            <button type="button" className="text-xs text-text-muted hover:text-error transition-colors duration-150">
              Desconectar
            </button>
          </div>
        </DashboardCard>
        <DashboardCard title="GitHub" description="Sincroniza repositorios y commits.">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <KeyRound className="w-4 h-4" />
              No conectado
            </div>
            <button type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-text hover:bg-surface-hover transition-colors duration-150">
              Conectar
            </button>
          </div>
        </DashboardCard>
      </div>
    );
  }

  // personal-information (default)
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-display font-semibold text-text">Personal information</h1>
      <DashboardCard title="Profile" description="Cómo apareces en NORTH.">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-display text-lg font-semibold shrink-0">
            {(user.name ?? user.email).slice(0, 2).toUpperCase()}
          </div>
          <button type="button" className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-text hover:bg-surface-hover transition-colors duration-150">
            Change avatar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" value={user.name ?? ''} />
          <Field label="Display name" value={user.name ?? ''} />
          <Field label="Username" value={user.email.split('@')[0]} />
        </div>
        <div className="space-y-1.5">
          <label className="ui-label block">Biography</label>
          <textarea
            rows={3}
            placeholder="Cuéntanos sobre ti…"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 transition-[border-color,box-shadow] duration-150 resize-none"
          />
        </div>
      </DashboardCard>
    </div>
  );
}