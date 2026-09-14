import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LanguageSelector } from '@/components/LanguageSelector'
import { ThemeToggle } from '@/components/ThemeToggle'
import { expandWindow } from '@/lib/tauri'
import { login, loginWithAdminId, loginWithGoogle, type SessionUser } from '@/lib/auth'

type Stage = 'boot' | 'login'
type Mode = 'email' | 'admin'
type Lang = 'es' | 'en'

const COPY = {
  es: {
    initializing: 'Inicializando…', title: 'Inicia sesión en North', google: 'Continuar con Google', auid: 'Continuar con AUID', or: 'o', email: 'Correo electrónico', password: 'Contraseña', showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña', signingIn: 'Iniciando sesión…', signIn: 'Iniciar sesión', noAccount: '¿Aún no tienes una cuenta?', requestAccess: 'Solicitar acceso', help: '¿Necesitas ayuda para acceder?', contact: 'Contactar soporte', auidTitle: 'Continuar con AUID', adminId: 'Identificador único de administrador', verifying: 'Verificando…', continue: 'Continuar', useEmail: 'Usar correo y contraseña', requiredAdmin: 'Ingresa tu AUID y correo electrónico.', invalidAdmin: 'El AUID no es válido.', requiredCredentials: 'Ingresa tu correo y contraseña.', invalidEmail: 'Ingresa un correo electrónico válido.', signInError: 'No fue posible iniciar sesión.', agreement: 'Al continuar, acepto los', terms: 'términos de uso', privacy: 'política de privacidad', and: 'y la', support: 'Soporte', status: 'Estado del sistema',
  },
  en: {
    initializing: 'Initializing…', title: 'Sign in to North', google: 'Continue with Google', auid: 'Continue with AUID', or: 'or', email: 'Email', password: 'Password', showPassword: 'Show password', hidePassword: 'Hide password', signingIn: 'Signing in…', signIn: 'Sign in', noAccount: "Don’t have an account?", requestAccess: 'Request access', help: 'Need help accessing North?', contact: 'Contact support', auidTitle: 'Continue with AUID', adminId: 'Admin Unique ID', verifying: 'Verifying…', continue: 'Continue', useEmail: 'Use email and password', requiredAdmin: 'Enter your AUID and email.', invalidAdmin: 'Invalid AUID.', requiredCredentials: 'Enter your email and password.', invalidEmail: 'Enter a valid email.', signInError: 'Could not sign in.', agreement: 'By continuing, I agree to the', terms: 'terms of use', privacy: 'privacy policy', and: 'and', support: 'Support', status: 'System status',
  },
} as const

function GoogleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11C3.26 21.3 7.31 24 12 24z" /><path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.27V6.62H1.28A11.97 11.97 0 0 0 0 12c0 1.93.46 3.76 1.28 5.38l3.99-3.11z" /><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.62l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z" /></svg>
}

function BadgeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c0-2 1.8-3 4-3s4 1 4 3" /></svg>
}

function EyeIcon({ off }: { off: boolean }) {
  return off
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A9.9 9.9 0 0112 4c5 0 9 4 10 8-.4 1.4-1.1 2.7-2 3.8M6.2 6.2C4.4 7.4 3 9 2 12c1 4 5 8 10 8 1.6 0 3.1-.4 4.4-1.1" /></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12c1-4 5-8 10-8s9 4 10 8c-1 4-5 8-10 8s-9-4-10-8z" /><circle cx="12" cy="12" r="3" /></svg>
}

export function Login({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [stage, setStage] = useState<Stage>('boot')
  const [mode, setMode] = useState<Mode>('email')
  const [lang, setLang] = useState<Lang>('es')
  const [showPass, setShowPass] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = COPY[lang]
  const localePath = lang === 'es' ? 'es-lat' : 'en-us'

  useEffect(() => {
    const timer = setTimeout(() => setStage('login'), 700)
    return () => clearTimeout(timer)
  }, [])

  async function finish(user: SessionUser) {
    setLoading(false)
    setExpanded(true)
    await expandWindow()
    setTimeout(() => onSuccess(user), 500)
  }

  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  async function handleAdminLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const normalizedId = adminId.trim()
    const normalizedEmail = email.trim()
    if (!normalizedId || !normalizedEmail) return setError(t.requiredAdmin)
    if (normalizedId.length < 3) return setError(t.invalidAdmin)
    if (!validEmail(normalizedEmail)) return setError(t.invalidEmail)
    setLoading(true)
    try { await finish(await loginWithAdminId(normalizedId, normalizedEmail)) }
    catch { setLoading(false); setError(t.signInError) }
  }

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !pass) return setError(t.requiredCredentials)
    if (!validEmail(normalizedEmail)) return setError(t.invalidEmail)
    setLoading(true)
    try { await finish(await login(normalizedEmail, pass)) }
    catch { setLoading(false); setError(t.signInError) }
  }

  return (
    <div className="fixed inset-0 min-h-screen flex flex-col overflow-y-auto bg-bg" lang={lang}>
      {!expanded && <header className="flex items-center justify-between px-8 py-6"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded border border-accent/40 flex items-center justify-center font-display font-bold text-xs text-accent">N</div><span className="font-display text-xs tracking-[0.25em] text-text-dim">NORTH</span></div><div className="flex items-center gap-3"><ThemeToggle language={lang} /><LanguageSelector value={lang} onChange={(value) => setLang(value as Lang)} /></div></header>}

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className={`transition-all duration-500 ease-out rounded-2xl border border-line overflow-hidden bg-panel ${expanded ? 'w-full h-full rounded-none' : 'w-full max-w-[440px] shadow-sm'}`}>
          {!expanded && <div className="w-full px-10 py-10 animate-in fade-in">
            {stage === 'boot' && <div className="font-display text-xs text-text-dim flex items-center justify-center gap-2 py-20">{t.initializing}</div>}
            {stage === 'login' && mode === 'email' && <>
              <h1 className="font-display text-2xl font-bold text-text mb-6">{t.title}</h1>
              <button type="button" onClick={loginWithGoogle} className="w-full h-10 rounded-md border border-line flex items-center justify-center gap-2 text-sm font-medium text-text hover:bg-panel-2 transition-colors mb-2"><GoogleIcon />{t.google}</button>
              <button type="button" onClick={() => setMode('admin')} className="w-full h-10 rounded-md border border-line flex items-center justify-center gap-2 text-sm font-medium text-text hover:bg-panel-2 transition-colors mb-5"><BadgeIcon />{t.auid}</button>
              <div className="w-full flex items-center gap-3 mb-5"><div className="flex-1 h-px bg-line" /><span className="text-xs text-text-dim">{t.or}</span><div className="flex-1 h-px bg-line" /></div>
              <form onSubmit={handleEmailLogin} className="w-full space-y-4">
                <label className="block"><span className="block text-sm font-medium text-text mb-1.5">{t.email}</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
                <label className="block"><span className="block text-sm font-medium text-text mb-1.5">{t.password}</span><span className="relative block"><Input type={showPass ? 'text' : 'password'} value={pass} onChange={(event) => setPass(event.target.value)} autoComplete="current-password" className="pr-10" /><button type="button" onClick={() => setShowPass((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text" aria-label={showPass ? t.hidePassword : t.showPassword}><EyeIcon off={showPass} /></button></span></label>
                {error && <div role="alert" className="text-xs text-red-600 font-mono">{error}</div>}
                <Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t.signingIn : t.signIn}</Button>
              </form>
              <div className="text-center text-sm text-text-dim mt-6 space-y-1"><div>{t.noAccount} <a href={`https://blackpolar.org/${localePath}/contact`} className="text-accent hover:underline">{t.requestAccess}</a></div><div>{t.help} <a href={`https://blackpolar.org/${localePath}/contact`} className="text-accent hover:underline">{t.contact}</a></div></div>
            </>}
            {stage === 'login' && mode === 'admin' && <>
              <h1 className="font-display text-2xl font-bold text-text mb-6">{t.auidTitle}</h1>
              <form onSubmit={handleAdminLogin} className="w-full space-y-4">
                <label className="block"><span className="block text-sm font-medium text-text mb-1.5">{t.adminId}</span><Input value={adminId} onChange={(event) => setAdminId(event.target.value)} /></label>
                <label className="block"><span className="block text-sm font-medium text-text mb-1.5">{t.email}</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
                {error && <div role="alert" className="text-xs text-red-600 font-mono">{error}</div>}
                <Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t.verifying : t.continue}</Button>
                <button type="button" onClick={() => setMode('email')} className="text-sm text-text-dim hover:text-text text-center w-full pt-1">{t.useEmail}</button>
              </form>
            </>}
          </div>}
        </div>
        {!expanded && <p className="max-w-[440px] w-full text-center text-xs text-text-dim mt-6 leading-relaxed">{t.agreement} <a href={`https://blackpolar.org/${localePath}/legal/terms`} className="underline hover:text-text">{t.terms}</a> {t.and} <a href={`https://blackpolar.org/${localePath}/legal/privacy`} className="underline hover:text-text">{t.privacy}</a>.</p>}
      </main>

      {!expanded && <footer className="flex flex-wrap items-end justify-center gap-6 px-8 py-8 text-[11px] font-mono text-text-dim"><a href={`https://blackpolar.org/${localePath}/contact`} className="hover:text-text">{t.support}</a><a href="https://api.blackpolar.org" className="hover:text-text">{t.status}</a><a href={`https://blackpolar.org/${localePath}/legal/terms`} className="hover:text-text">{t.terms}</a><a href={`https://blackpolar.org/${localePath}/legal/privacy`} className="hover:text-text">{t.privacy}</a></footer>}
    </div>
  )
}
