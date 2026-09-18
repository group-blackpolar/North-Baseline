import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { NorthIcon } from '@/components/brand/NorthLogo'
import { LanguageSelector } from '@/components/LanguageSelector'
import { ThemeToggle } from '@/components/ThemeToggle'
import { expandWindow } from '@/lib/tauri'
import { useI18n, type Locale } from '@/lib/i18n'
import {
  completePendingOnboarding,
  FALLBACK_TERMS_VERSION,
  getIdentityConfig,
  listenForDesktopAuth,
  login,
  loginWithAUID,
  loginWithGoogle,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  savePendingOnboarding,
  signUpWithEmail,
  type SessionUser,
} from '@/lib/auth'

type Stage = 'boot' | 'ready'
type Mode = 'login' | 'auid' | 'signup' | 'signup-success' | 'forgot' | 'forgot-success' | 'reset' | 'reset-success'
function GoogleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11C3.26 21.3 7.31 24 12 24z" /><path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.27V6.62H1.28A11.97 11.97 0 0 0 0 12c0 1.93.46 3.76 1.28 5.38l3.99-3.11z" /><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.62l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z" /></svg>
}

function ShieldIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" /></svg>
}

function EyeIcon({ off }: { off: boolean }) {
  return off
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A9.9 9.9 0 0112 4c5 0 9 4 10 8-.4 1.4-1.1 2.7-2 3.8M6.2 6.2C4.4 7.4 3 9 2 12c1 4 5 8 10 8 1.6 0 3.1-.4 4.4-1.1" /></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12c1-4 5-8 10-8s9 4 10 8c-1 4-5 8-10 8s-9-4-10-8z" /><circle cx="12" cy="12" r="3" /></svg>
}

function passwordScore(password: string, email: string, firstName: string, lastName: string) {
  if (!password) return 0
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  const lowered = password.toLowerCase()
  const personal = [email.split('@')[0], firstName, lastName].map((value) => value.trim().toLowerCase()).filter((value) => value.length >= 3)
  if (personal.some((value) => lowered.includes(value))) score = Math.max(1, score - 1)
  return Math.min(4, score)
}

interface LoginProps {
  onSuccess: (user: SessionUser) => void
  onOnboardingIssue: (message: string) => void
}

export function Login({ onSuccess, onOnboardingIssue }: LoginProps) {
  const [expanded, setExpanded] = useState(false)
  const [stage, setStage] = useState<Stage>('boot')
  const [mode, setMode] = useState<Mode>('login')
  const { t, locale: lang, setLocale: setLang } = useI18n();
  const [showPass, setShowPass] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [auid, setAuid] = useState('')
  const [hasOrganization, setHasOrganization] = useState(false)
  const [invitationCode, setInvitationCode] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [termsVersion, setTermsVersion] = useState(FALLBACK_TERMS_VERSION)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')
  const localePath = lang === 'es' ? 'es-lat' : 'en-us'
  const strength = useMemo(() => passwordScore(pass, email, firstName, lastName), [pass, email, firstName, lastName])
  const strengthLabels = ['', t('auth.weak'), t('auth.fair'), t('auth.good'), t('auth.strong')]

  const finish = useCallback(async (user: SessionUser) => {
    let finalUser = user
    try {
      const onboarding = await completePendingOnboarding(user)
      finalUser = onboarding?.user ?? user
    } catch (onboardingError) {
      onOnboardingIssue(onboardingError instanceof Error ? onboardingError.message : 'No fue posible completar el registro')
    }
    setLoading(false)
    setExpanded(true)
    await expandWindow()
    setTimeout(() => onSuccess(finalUser), 500)
  }, [onOnboardingIssue, onSuccess])

  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('ready')
      if (resetToken) setMode('reset')
    }, 500)
    getIdentityConfig().then((config) => {
      setTermsVersion(config.termsVersion)
      setGoogleEnabled(config.googleAuthEnabled)
    }).catch(() => {})
    let unlisten = () => {}
    listenForDesktopAuth(
      (user) => { void finish(user) },
      (message) => { setLoading(false); setError(message) },
    ).then((dispose) => { unlisten = dispose }).catch(() => {})
    return () => { clearTimeout(timer); unlisten() }
  }, [finish, resetToken])

  const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const validInvitation = (value: string) => /^[a-f0-9]{64}$/.test(value.trim().toLowerCase())

  function validateSignup(includePassword: boolean) {
    setError('')
    if (!firstName.trim() || !lastName.trim()) return t('auth.requiredNames')
    if (!validEmail(email)) return t('auth.invalidEmail')
    if (hasOrganization && !validInvitation(invitationCode)) return t('auth.invalidInvitation')
    if (includePassword && (pass.length < 12 || pass.length > 128 || strength < 3)) return t('auth.invalidPassword')
    if (includePassword && pass !== confirmPass) return t('auth.passwordMismatch')
    if (!acceptedLegal) return t('auth.acceptLegal')
    return ''
  }

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !pass) return setError(t('auth.requiredCredentials'))
    if (!validEmail(normalizedEmail)) return setError(t('auth.invalidEmail'))
    setLoading(true)
    try { await finish(await login(normalizedEmail, pass)) }
    catch { setLoading(false); setError(t('auth.signInError')) }
  }

  async function handleAuidLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return setError(t('auth.requiredCredentials'))
    if (!validEmail(normalizedEmail)) return setError(t('auth.invalidEmail'))
    if (auid.trim().length < 8) return setError(t('auth.auidError'))
    setLoading(true)
    try {
      await finish(await loginWithAUID(normalizedEmail, auid.trim()))
    } catch (auidError) {
      setLoading(false)
      setError(auidError instanceof Error ? auidError.message : t('auth.auidError'))
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    if (!googleEnabled) return setError(t('auth.googleUnavailable'))
    try { await loginWithGoogle() }
    catch (googleError) {
      setLoading(false)
      setError(googleError instanceof Error ? googleError.message : t('auth.signInError'))
    }
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault()
    const validationError = validateSignup(true)
    if (validationError) return setError(validationError)
    setLoading(true)
    try {
      await signUpWithEmail({ firstName, lastName, email, password: pass })
      savePendingOnboarding({ firstName, lastName, email, termsVersion, ...(hasOrganization ? { invitationCode } : {}) })
      setMode('signup-success')
      setPass('')
      setConfirmPass('')
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : t('auth.signupError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    const validationError = validateSignup(false)
    if (validationError) return setError(validationError)
    if (!googleEnabled) return setError(t('auth.googleUnavailable'))
    setLoading(true)
    savePendingOnboarding({ firstName, lastName, email, termsVersion, ...(hasOrganization ? { invitationCode } : {}) })
    try { await loginWithGoogle({ requestSignUp: true }) }
    catch (googleError) {
      setLoading(false)
      setError(googleError instanceof Error ? googleError.message : t('auth.signupError'))
    }
  }

  async function handleRecovery(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!validEmail(email)) return setError(t('auth.invalidEmail'))
    setLoading(true)
    try { await requestPasswordReset(email); setMode('forgot-success') }
    catch (recoveryError) { setError(recoveryError instanceof Error ? recoveryError.message : t('auth.signInError')) }
    finally { setLoading(false) }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!resetToken) return setError(t('auth.signInError'))
    if (pass.length < 12 || pass.length > 128 || strength < 3) return setError(t('auth.invalidPassword'))
    if (pass !== confirmPass) return setError(t('auth.passwordMismatch'))
    setLoading(true)
    try {
      await resetPassword(resetToken, pass)
      window.history.replaceState({}, '', window.location.pathname)
      setPass('')
      setConfirmPass('')
      setMode('reset-success')
    } catch (resetError) { setError(resetError instanceof Error ? resetError.message : t('auth.signInError')) }
    finally { setLoading(false) }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    if (!validEmail(email)) return setError(t('auth.invalidEmail'))
    setLoading(true)
    try { await resendVerification(email); setNotice(t('auth.resent')) }
    catch (resendError) { setError(resendError instanceof Error ? resendError.message : t('auth.signupError')) }
    finally { setLoading(false) }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
    setPass('')
    setConfirmPass('')
    setAuid('')
  }

  return (
    <div className="fixed inset-0 min-h-screen flex flex-col overflow-y-auto bg-bg" lang={lang}>
      {!expanded && <header className="flex items-center justify-between px-5 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <NorthIcon className="size-7" />
          <span className="font-display text-xs tracking-[0.25em] text-text-dim">NORTH</span>
        </div><div className="flex items-center gap-3"><ThemeToggle language={lang} /><LanguageSelector value={lang} onChange={(value) => setLang(value as Locale)} /></div></header>}

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className={`transition-all duration-500 ease-out rounded-2xl border border-line overflow-hidden bg-panel ${expanded ? 'w-full h-full rounded-none' : `w-full ${mode === 'signup' ? 'max-w-[620px]' : 'max-w-[440px]'} shadow-sm`}`}>
          {!expanded && <div className={`w-full ${mode === 'signup' ? 'px-6 sm:px-10 py-8' : 'px-6 sm:px-10 py-10'} animate-in fade-in`}>
            {stage === 'boot' && <div className="font-display text-xs text-text-dim flex items-center justify-center gap-2 py-20">{t('auth.initializing')}</div>}

            {stage === 'ready' && mode === 'login' && <>
              <h1 className="font-display text-2xl font-bold text-text mb-6">{t('auth.signInTitle')}</h1>
              <button type="button" onClick={handleGoogleLogin} disabled={loading || !googleEnabled} title={!googleEnabled ? t('auth.googleUnavailable') : undefined} className="w-full h-10 rounded-md border border-line flex items-center justify-center gap-2 text-sm font-medium text-text hover:bg-panel-2 transition-colors mb-3 disabled:opacity-50"><GoogleIcon />{t('auth.googleLogin')}</button>
              <button type="button" onClick={() => switchMode('auid')} disabled={loading} className="w-full h-10 rounded-md border border-line flex items-center justify-center gap-2 text-sm font-medium text-text hover:bg-panel-2 transition-colors mb-5 disabled:opacity-50"><ShieldIcon />{t('auth.auidLogin')}</button>
              <div className="w-full flex items-center gap-3 mb-5"><div className="flex-1 h-px bg-line" /><span className="text-xs text-text-dim">{t('auth.or')}</span><div className="flex-1 h-px bg-line" /></div>
              <form onSubmit={handleEmailLogin} className="w-full space-y-4">
                <Field label={t('auth.email')}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></Field>
                <PasswordField label={t('auth.password')} value={pass} onChange={setPass} visible={showPass} setVisible={setShowPass} showLabel={t('auth.showPassword')} hideLabel={t('auth.hidePassword')} autoComplete="current-password" />
                <div className="flex justify-end"><button type="button" onClick={() => switchMode('forgot')} className="text-xs text-accent hover:underline">{t('auth.forgotPassword')}</button></div>
                {notice && <div role="status" className="text-xs text-accent font-mono">{notice}</div>}
                {error && <div role="alert" className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</div>}
                <Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t('auth.signingIn') : t('auth.signIn')}</Button>
              </form>
              <div className="text-center text-sm text-text-dim mt-6 space-y-1"><div>{t('auth.noAccount')} <button type="button" onClick={() => switchMode('signup')} className="text-accent hover:underline">{t('auth.createLink')}</button></div><div>{t('auth.help')} <a href={`https://blackpolar.org/${localePath}/contact`} className="text-accent hover:underline">{t('auth.contact')}</a></div></div>
            </>}

            {stage === 'ready' && mode === 'auid' && <>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent"><ShieldIcon /></div>
                <h1 className="font-display text-xl font-bold text-text">{t('auth.auidTitle')}</h1>
              </div>
              <p className="text-sm text-text-dim mb-6">{t('auth.auidBody')}</p>
              <form onSubmit={handleAuidLogin} className="space-y-4">
                <Field label={t('auth.email')}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
                <Field label={t('auth.auidLabel')} hint={t('auth.auidHint')}><Input value={auid} onChange={(event) => setAuid(event.target.value)} autoComplete="off" className="font-mono tracking-wide" minLength={8} maxLength={256} /></Field>
                {error && <div role="alert" className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</div>}
                <Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t('auth.signingIn') : t('auth.auidSubmit')}</Button>
                <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-text-dim hover:text-text">{t('auth.backToLogin')}</button>
              </form>
            </>}

            {stage === 'ready' && mode === 'signup' && <>
              <h1 className="font-display text-2xl font-bold text-text">{t('auth.createTitle')}</h1>
              <p className="text-sm text-text-dim mt-2 mb-6">{t('auth.createIntro')}</p>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={t('auth.firstName')}><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" maxLength={60} /></Field>
                  <Field label={t('auth.lastName')}><Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" maxLength={60} /></Field>
                </div>
                <Field label={t('auth.email')}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
                <fieldset>
                  <legend className="block text-sm font-medium text-text mb-2">{t('auth.organizationQuestion')}</legend>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-panel-2 p-1 border border-line">
                    {[false, true].map((value) => <button key={String(value)} type="button" onClick={() => setHasOrganization(value)} aria-pressed={hasOrganization === value} className={`h-9 rounded-md text-sm font-medium transition-colors ${hasOrganization === value ? 'bg-panel text-text shadow-sm' : 'text-text-dim hover:text-text'}`}>{value ? t('auth.yes') : t('auth.no')}</button>)}
                  </div>
                </fieldset>
                {hasOrganization && <Field label={t('auth.invitation')} hint={t('auth.invitationHint')}><Input value={invitationCode} onChange={(event) => setInvitationCode(event.target.value.replace(/\s/g, '').toLowerCase())} autoComplete="off" maxLength={64} className="tracking-wide" /></Field>}
                <div className="grid sm:grid-cols-2 gap-4">
                  <PasswordField label={t('auth.password')} value={pass} onChange={setPass} visible={showPass} setVisible={setShowPass} showLabel={t('auth.showPassword')} hideLabel={t('auth.hidePassword')} autoComplete="new-password" />
                  <PasswordField label={t('auth.confirmPassword')} value={confirmPass} onChange={setConfirmPass} visible={showPass} setVisible={setShowPass} showLabel={t('auth.showPassword')} hideLabel={t('auth.hidePassword')} autoComplete="new-password" />
                </div>
                <div>
                  <div className="grid grid-cols-4 gap-1" role="progressbar" aria-label={t('auth.password')} aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength}>{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1.5 rounded-full ${strength >= level ? (strength < 3 ? 'bg-orange-500' : 'bg-accent') : 'bg-line'}`} />)}</div>
                  <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-text-dim"><span>{t('auth.passwordHelp')}</span><span className="font-medium text-text shrink-0">{strengthLabels[strength]}</span></div>
                </div>
                <label className="flex items-start gap-2.5 text-xs text-text-dim cursor-pointer"><input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" /><span>{t('auth.legalCheck')} <span className="font-mono text-[10px]">({termsVersion})</span></span></label>
                {error && <div role="alert" className="text-xs text-red-600 dark:text-red-400 font-mono">{error}</div>}
                <Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t('auth.creating') : t('auth.create')}</Button>
                <div className="relative py-1"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div><div className="relative flex justify-center"><span className="bg-panel px-3 text-xs text-text-dim">{t('auth.or')}</span></div></div>
                <button type="button" onClick={handleGoogleSignup} disabled={loading || !googleEnabled} title={!googleEnabled ? t('auth.googleUnavailable') : undefined} className="w-full h-10 rounded-md border border-line flex items-center justify-center gap-2 text-sm font-medium text-text hover:bg-panel-2 transition-colors disabled:opacity-50"><GoogleIcon />{t('auth.googleSignup')}</button>
                <div className="text-center text-sm text-text-dim">{t('auth.hasAccount')} <button type="button" onClick={() => switchMode('login')} className="text-accent hover:underline">{t('auth.signIn')}</button></div>
              </form>
            </>}

            {stage === 'ready' && mode === 'signup-success' && <div className="text-center py-8">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent text-xl">✓</div>
              <h1 className="font-display text-2xl font-bold text-text">{t('auth.verifyTitle')}</h1>
              <p className="mt-3 text-sm leading-relaxed text-text-dim">{t('auth.verifyBody')}</p>
              {notice && <p role="status" className="mt-3 text-xs text-accent">{notice}</p>}
              {error && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
              <button type="button" onClick={handleResend} disabled={loading} className="mt-5 text-sm text-accent hover:underline disabled:opacity-50">{t('auth.resend')}</button>
              <Button type="button" variant="dark" onClick={() => switchMode('login')} className="north-primary w-full h-10 mt-7">{t('auth.backToLogin')}</Button>
            </div>}

            {stage === 'ready' && mode === 'forgot' && <>
              <h1 className="font-display text-2xl font-bold text-text">{t('auth.recoveryTitle')}</h1>
              <p className="mt-2 mb-6 text-sm text-text-dim">{t('auth.recoveryBody')}</p>
              <form onSubmit={handleRecovery} className="space-y-4"><Field label={t('auth.email')}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}<Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t('auth.creating') : t('auth.sendRecovery')}</Button><button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-text-dim hover:text-text">{t('auth.backToLogin')}</button></form>
            </>}

            {stage === 'ready' && mode === 'forgot-success' && <div className="text-center py-8"><div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent text-xl">✓</div><h1 className="font-display text-2xl font-bold text-text">{t('auth.recoverySent')}</h1><p className="mt-3 text-sm leading-relaxed text-text-dim">{t('auth.recoverySentBody')}</p><Button type="button" variant="dark" onClick={() => switchMode('login')} className="north-primary w-full h-10 mt-7">{t('auth.backToLogin')}</Button></div>}

            {stage === 'ready' && mode === 'reset' && <>
              <h1 className="font-display text-2xl font-bold text-text mb-6">{t('auth.resetTitle')}</h1>
              <form onSubmit={handleReset} className="space-y-4"><PasswordField label={t('auth.password')} value={pass} onChange={setPass} visible={showPass} setVisible={setShowPass} showLabel={t('auth.showPassword')} hideLabel={t('auth.hidePassword')} autoComplete="new-password" /><PasswordField label={t('auth.confirmPassword')} value={confirmPass} onChange={setConfirmPass} visible={showPass} setVisible={setShowPass} showLabel={t('auth.showPassword')} hideLabel={t('auth.hidePassword')} autoComplete="new-password" /><div className="grid grid-cols-4 gap-1" role="progressbar" aria-label={t('auth.password')} aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength}>{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1.5 rounded-full ${strength >= level ? (strength < 3 ? 'bg-orange-500' : 'bg-accent') : 'bg-line'}`} />)}</div>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}<Button type="submit" variant="dark" disabled={loading} className="north-primary w-full h-10">{loading ? t('auth.creating') : t('auth.resetAction')}</Button></form>
            </>}

            {stage === 'ready' && mode === 'reset-success' && <div className="text-center py-8"><div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent text-xl">✓</div><h1 className="font-display text-2xl font-bold text-text">{t('auth.resetDone')}</h1><p className="mt-3 text-sm text-text-dim">{t('auth.resetDoneBody')}</p><Button type="button" variant="dark" onClick={() => switchMode('login')} className="north-primary w-full h-10 mt-7">{t('auth.signIn')}</Button></div>}
          </div>}
        </div>
        {!expanded && mode !== 'signup' && mode !== 'auid' && <p className="max-w-[440px] w-full text-center text-xs text-text-dim mt-6 leading-relaxed">{t('auth.agreement')} <a href={`https://blackpolar.org/${localePath}/legal/terms`} className="underline hover:text-text">{t('auth.terms')}</a> {t('auth.and')} <a href={`https://blackpolar.org/${localePath}/legal/privacy`} className="underline hover:text-text">{t('auth.privacy')}</a>.</p>}
      </main>

      {!expanded && <footer className="flex flex-wrap items-end justify-center gap-6 px-8 py-7 text-[11px] font-mono text-text-dim"><a href={`https://blackpolar.org/${localePath}/contact`} className="hover:text-text">{t('auth.support')}</a><a href="https://api.blackpolar.org" className="hover:text-text">{t('auth.status')}</a><a href={`https://blackpolar.org/${localePath}/legal/terms`} className="hover:text-text">{t('auth.terms')}</a><a href={`https://blackpolar.org/${localePath}/legal/privacy`} className="hover:text-text">{t('auth.privacy')}</a></footer>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-sm font-medium text-text mb-1.5">{label}</span>{children}{hint && <span className="block text-[11px] text-text-dim mt-1.5">{hint}</span>}</label>
}

function PasswordField({ label, value, onChange, visible, setVisible, showLabel, hideLabel, autoComplete }: {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  setVisible: (value: boolean) => void
  showLabel: string
  hideLabel: string
  autoComplete: string
}) {
  return <Field label={label}><span className="relative block"><Input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={12} maxLength={128} className="pr-10" /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text" aria-label={visible ? hideLabel : showLabel}><EyeIcon off={visible} /></button></span></Field>
}