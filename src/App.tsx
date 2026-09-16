import { useEffect, useState } from 'react'
import { Login } from '@/views/Login'
import { Sidebar, type ViewId } from '@/views/Sidebar'
import { TopBar } from '@/views/TopBar'
import { NotesTasksView } from '@/views/NotesTasksView'
import { UsersAdminView } from '@/views/UsersAdminView'
import { DashboardsView } from '@/views/DashboardsView'
import { LogsView } from '@/views/LogsView'
import { ApiHealthView } from '@/views/ApiHealthView'
import { ApiKeysView } from '@/views/ApiKeysView'
import { CiCdView } from '@/views/CiCdView'
import { AuditoriaView } from '@/views/AuditoriaView'
import { DbBackupsView } from '@/views/DbBackupsView'
import { PlaceholderView } from '@/views/PlaceholderView'
import {
  acceptTerms,
  completePendingOnboarding,
  discardPendingInvitation,
  FALLBACK_TERMS_VERSION,
  getIdentityConfig,
  getPendingOnboarding,
  getSession,
  logout,
  replacePendingInvitation,
  type IdentityConfig,
  type SessionUser,
} from '@/lib/auth'
import { isTauri } from '@/lib/tauri'


const TITLES: Record<ViewId, string> = {
  'notas-tareas': 'Notas y Tareas',
  usuarios: 'Usuarios',
  dashboards: 'Paneles',
  logs: 'Registros',
  'api-health': 'Estado de API',
  'api-keys': 'Claves de API',
  cicd: 'CI/CD',
  auditoria: 'Auditoría',
  'db-backups': 'Base de Datos',
  config: 'Configuración',
  perfil: 'Perfil',
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(!isTauri())
  const [active, setActive] = useState<ViewId>('notas-tareas')
  const [onboardingIssue, setOnboardingIssue] = useState('')
  const [identityConfig, setIdentityConfig] = useState<IdentityConfig>({
    termsVersion: FALLBACK_TERMS_VERSION,
    passwordMinLength: 12,
    passwordMaxLength: 128,
    googleAuthEnabled: false,
    captchaRequired: false,
  })
  const [invitationCode, setInvitationCode] = useState('')

  useEffect(() => {
    getIdentityConfig().then(setIdentityConfig).catch(() => {})
    if (isTauri()) {
      setCheckingSession(false)
      return
    }
    getSession()
      .then(async (sessionUser) => {
        if (!sessionUser) return
        try {
          const onboarding = await completePendingOnboarding(sessionUser)
          setUser(onboarding?.user ?? sessionUser)
        } catch (error) {
          setUser(sessionUser)
          setOnboardingIssue(error instanceof Error ? error.message : 'No fue posible completar el registro')
          setInvitationCode(getPendingOnboarding()?.invitationCode ?? '')
        }
      })
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
    setActive('notas-tareas')
  }

  async function handleTermsAcceptance() {
    if (!user) return
    try {
      setUser(await acceptTerms(user, identityConfig.termsVersion))
    } catch (error) {
      setOnboardingIssue(error instanceof Error ? error.message : 'No fue posible registrar la aceptación')
    }
  }

  async function retryInvitation() {
    if (!user || !/^[a-f0-9]{64}$/.test(invitationCode)) return
    replacePendingInvitation(invitationCode)
    try {
      const onboarding = await completePendingOnboarding(user)
      setUser(onboarding?.user ?? user)
      setOnboardingIssue('')
    } catch (error) {
      setOnboardingIssue(error instanceof Error ? error.message : 'La invitación no pudo aceptarse')
    }
  }

  function continueWithoutInvitation() {
    discardPendingInvitation()
    setOnboardingIssue('')
    setInvitationCode('')
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg text-text-dim font-display text-xs">
        Verificando sesión…
      </div>
    )
  }

  if (!user) return <Login onSuccess={setUser} onOnboardingIssue={(message) => {
    setOnboardingIssue(message)
    setInvitationCode(getPendingOnboarding()?.invitationCode ?? '')
  }} />

  if (user.termsVersion !== identityConfig.termsVersion || !user.termsAcceptedAt) {
    return <TermsAcceptance version={identityConfig.termsVersion} onAccept={handleTermsAcceptance} error={onboardingIssue} />
  }

  return (
    <div className="h-screen w-screen flex bg-bg">
      {onboardingIssue && (
        getPendingOnboarding()?.invitationCode
          ? <InvitationRecovery error={onboardingIssue} code={invitationCode} setCode={setInvitationCode} onRetry={retryInvitation} onSkip={continueWithoutInvitation} />
          : <div role="alert" className="fixed z-50 left-1/2 top-4 -translate-x-1/2 max-w-xl rounded-lg border border-red-500/30 bg-panel px-4 py-3 text-sm text-text shadow-lg">{onboardingIssue}<button type="button" onClick={() => setOnboardingIssue('')} className="ml-4 text-text-dim hover:text-text" aria-label="Cerrar">&times;</button></div>
      )}
      <Sidebar active={active} setActive={setActive} user={user} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={TITLES[active]} breadcrumb={active} />
        <div className="flex-1 overflow-y-auto">
          {active === 'notas-tareas' && <NotesTasksView />}
          {active === 'usuarios' && <UsersAdminView />}
          {active === 'dashboards' && <DashboardsView />}
          {active === 'logs' && <LogsView />}
          {active === 'api-health' && <ApiHealthView />}
          {active === 'api-keys' && <ApiKeysView />}
          {active === 'cicd' && <CiCdView />}
          {active === 'auditoria' && <AuditoriaView />}
          {active === 'db-backups' && <DbBackupsView />}
          {active === 'config' && <PlaceholderView label="configuración general" />}
          {active === 'perfil' && <PlaceholderView label="perfil de usuario" />}
        </div>
      </div>
    </div>
  )
}

function TermsAcceptance({ version, onAccept, error }: { version: string; onAccept: () => Promise<void>; error: string }) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  return <div className="fixed inset-0 flex items-center justify-center bg-bg p-4"><div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-sm"><div className="text-xs font-mono text-accent mb-3">NORTH / LEGAL</div><h1 className="font-display text-2xl font-bold text-text">Términos actualizados</h1><p className="mt-3 text-sm leading-relaxed text-text-dim">Para continuar, confirma la versión {version} de los términos de uso y la política de privacidad. CoreCrow registrará la versión y la fecha de aceptación.</p><label className="mt-5 flex items-start gap-3 text-sm text-text cursor-pointer"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 accent-[var(--color-accent)]" /><span>Acepto los <a href="https://blackpolar.org/es-lat/legal/terms" className="underline">términos</a> y la <a href="https://blackpolar.org/es-lat/legal/privacy" className="underline">política de privacidad</a>.</span></label>{error && <p role="alert" className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}<button type="button" disabled={!accepted || loading} onClick={async () => { setLoading(true); await onAccept(); setLoading(false) }} className="north-primary mt-6 h-10 w-full rounded-md bg-black text-sm font-medium text-white disabled:opacity-40">{loading ? 'Registrando…' : 'Aceptar y continuar'}</button></div></div>
}

function InvitationRecovery({ error, code, setCode, onRetry, onSkip }: { error: string; code: string; setCode: (value: string) => void; onRetry: () => Promise<void>; onSkip: () => void }) {
  const valid = /^[a-f0-9]{64}$/.test(code)
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div role="dialog" aria-modal="true" aria-labelledby="invite-recovery-title" className="w-full max-w-md rounded-2xl border border-line bg-panel p-7 shadow-xl"><div className="text-xs font-mono text-accent mb-2">ORGANIZACIÓN</div><h2 id="invite-recovery-title" className="font-display text-xl font-bold text-text">Corrige tu invitación</h2><p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p><label className="mt-5 block text-sm font-medium text-text">Código de invitación<input value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, '').toLowerCase())} maxLength={64} className="mt-2 w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-mono text-sm outline-none focus:border-accent" /></label><div className="mt-5 flex flex-col-reverse sm:flex-row gap-2"><button type="button" onClick={onSkip} className="h-10 flex-1 rounded-md border border-line text-sm text-text-dim hover:text-text">Continuar sin organización</button><button type="button" disabled={!valid} onClick={onRetry} className="north-primary h-10 flex-1 rounded-md bg-black text-sm font-medium text-white disabled:opacity-40">Reintentar</button></div></div></div>
}
