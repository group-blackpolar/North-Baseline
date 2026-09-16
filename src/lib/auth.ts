import { isTauri } from './tauri'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.blackpolar.org'
const NORTH_WEB_URL = import.meta.env.VITE_NORTH_WEB_URL ?? 'https://north.blackpolar.org'
export const FALLBACK_TERMS_VERSION = '2026-09-16'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'DEVELOPER' | 'ADMIN' | 'SUPERADMIN'
  emailVerified: boolean
  termsAcceptedAt: string | null
  termsVersion: string | null
}

export interface IdentityConfig {
  termsVersion: string
  passwordMinLength: number
  passwordMaxLength: number
  googleAuthEnabled: boolean
  captchaRequired: false
}

export interface PendingOnboarding {
  firstName: string
  lastName: string
  email: string
  termsVersion: string
  invitationCode?: string
}

export interface OnboardingResult {
  invitationAccepted: boolean
  user: SessionUser
}

let memorySession: { token: string; user: SessionUser } | null = null
let memoryOnboarding: PendingOnboarding | null = null
let desktopOAuth: { nonce: string; verifier: string } | null = null

const PENDING_ONBOARDING_KEY = 'north-pending-onboarding-v2'

function parseUser(data: Record<string, unknown>): SessionUser {
  return {
    id: String(data.id),
    email: String(data.email),
    name: typeof data.name === 'string' ? data.name : null,
    role: (data.role as SessionUser['role']) ?? 'USER',
    emailVerified: Boolean(data.emailVerified),
    termsAcceptedAt: typeof data.termsAcceptedAt === 'string' ? data.termsAcceptedAt : null,
    termsVersion: typeof data.termsVersion === 'string' ? data.termsVersion : null,
  }
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>
  if (typeof record.message === 'string') return record.message
  if (typeof record.error === 'string') return record.error
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as Record<string, unknown>
    if (typeof nested.message === 'string') return nested.message
  }
  return fallback
}

async function responseError(res: Response, fallback: string) {
  return errorMessage(await res.json().catch(() => null), fallback)
}

function sessionHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(memorySession ? { Authorization: `Bearer ${memorySession.token}` } : {}),
  }
}

async function authorizedFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: isTauri() ? 'omit' : 'include',
    headers: { ...sessionHeaders(), ...options.headers },
  })
}

async function betterAuthFetch(path: string, options: RequestInit = {}) {
  return authorizedFetch(`/v1/auth${path}`, options)
}

export async function getIdentityConfig(): Promise<IdentityConfig> {
  const res = await fetch(`${API_URL}/v1/identity/config`)
  if (!res.ok) {
    return {
      termsVersion: FALLBACK_TERMS_VERSION,
      passwordMinLength: 12,
      passwordMaxLength: 128,
      googleAuthEnabled: false,
      captchaRequired: false,
    }
  }
  return res.json()
}

export function savePendingOnboarding(data: PendingOnboarding) {
  const normalized: PendingOnboarding = {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    termsVersion: data.termsVersion,
    ...(data.invitationCode
      ? { invitationCode: data.invitationCode.trim().toLowerCase() }
      : {}),
  }
  if (isTauri()) memoryOnboarding = normalized
  else sessionStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(normalized))
}

export function getPendingOnboarding(): PendingOnboarding | null {
  if (isTauri()) return memoryOnboarding
  try {
    const raw = sessionStorage.getItem(PENDING_ONBOARDING_KEY)
    return raw ? JSON.parse(raw) as PendingOnboarding : null
  } catch {
    return null
  }
}

function clearPendingOnboarding() {
  memoryOnboarding = null
  if (!isTauri()) sessionStorage.removeItem(PENDING_ONBOARDING_KEY)
}

export function replacePendingInvitation(invitationCode?: string) {
  const pending = getPendingOnboarding()
  if (!pending) return
  savePendingOnboarding({
    ...pending,
    ...(invitationCode ? { invitationCode } : { invitationCode: undefined }),
  })
}

export function discardPendingInvitation() {
  clearPendingOnboarding()
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await betterAuthFetch('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'Credenciales inválidas'))
  const data = await res.json()
  const user = parseUser(data.user)
  if (isTauri()) memorySession = { token: data.token, user }
  return user
}

export async function signUpWithEmail(input: {
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<void> {
  const callbackURL = isTauri() ? NORTH_WEB_URL : window.location.origin
  const res = await betterAuthFetch('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      name: `${input.firstName.trim()} ${input.lastName.trim()}`,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      callbackURL,
    }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible crear la cuenta'))
}

export async function resendVerification(email: string): Promise<void> {
  const callbackURL = isTauri() ? NORTH_WEB_URL : window.location.origin
  const res = await betterAuthFetch('/send-verification-email', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), callbackURL }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible reenviar la verificación'))
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = isTauri() ? NORTH_WEB_URL : window.location.origin
  const res = await betterAuthFetch('/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), redirectTo }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible solicitar la recuperación'))
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await betterAuthFetch('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible cambiar la contraseña'))
}

export async function getSession(): Promise<SessionUser | null> {
  if (isTauri()) return memorySession?.user ?? null
  try {
    const res = await betterAuthFetch('/get-session')
    if (!res.ok) return null
    const data = await res.json()
    return data?.user ? parseUser(data.user) : null
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  if (isTauri() && memorySession) {
    await authorizedFetch('/v1/desktop-auth/session', { method: 'DELETE' }).catch(() => {})
  } else {
    await betterAuthFetch('/sign-out', { method: 'POST' }).catch(() => {})
  }
  memorySession = null
}

export function currentToken() {
  return memorySession?.token ?? null
}

function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function loginWithGoogle(options: { requestSignUp?: boolean } = {}) {
  if (isTauri()) {
    const verifier = randomHex()
    const nonce = randomHex()
    const challenge = await sha256Hex(verifier)
    desktopOAuth = { verifier, nonce }
    const url = new URL(`${API_URL}/v1/desktop-auth/google/start`)
    url.searchParams.set('nonce', nonce)
    url.searchParams.set('challenge', challenge)
    url.searchParams.set('signup', options.requestSignUp ? '1' : '0')
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url.toString())
    return
  }

  const res = await betterAuthFetch('/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      callbackURL: window.location.origin,
      errorCallbackURL: window.location.origin,
      requestSignUp: options.requestSignUp ?? false,
      disableRedirect: true,
    }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible continuar con Google'))
  const data = await res.json()
  if (!data?.url) throw new Error('Google no devolvió una URL de autorización')
  window.location.assign(data.url)
}

async function exchangeDesktopCode(urlValue: string): Promise<SessionUser> {
  const url = new URL(urlValue)
  if (url.protocol !== 'north:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
    throw new Error('Callback de autenticación inválido')
  }
  const error = url.searchParams.get('error')
  if (error) throw new Error('Google no pudo completar la autenticación')
  const code = url.searchParams.get('code')
  if (!code || !/^[a-f0-9]{64}$/.test(code) || !desktopOAuth) {
    throw new Error('La solicitud de Google expiró; inténtalo nuevamente')
  }
  const res = await fetch(`${API_URL}/v1/desktop-auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier: desktopOAuth.verifier }),
  })
  desktopOAuth = null
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible completar Google'))
  const data = await res.json()
  const user = parseUser(data.user)
  memorySession = { token: data.token, user }
  return user
}

export async function listenForDesktopAuth(
  onSuccess: (user: SessionUser) => void,
  onError: (message: string) => void,
) {
  if (!isTauri()) return () => {}
  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  const handle = async (urls: string[]) => {
    const callback = urls.find((url) => url.startsWith('north://auth/callback'))
    if (!callback) return
    try { onSuccess(await exchangeDesktopCode(callback)) }
    catch (error) { onError(error instanceof Error ? error.message : 'No fue posible completar Google') }
  }
  const current = await getCurrent()
  if (current) void handle(current)
  return onOpenUrl((urls) => { void handle(urls) })
}

export async function acceptTerms(user: SessionUser, version: string): Promise<SessionUser> {
  if (user.termsVersion === version && user.termsAcceptedAt) return user
  const res = await authorizedFetch('/v1/me/terms', {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
  if (!res.ok) throw new Error(await responseError(res, 'No fue posible registrar la aceptación legal'))
  const updated = parseUser(await res.json())
  if (memorySession) memorySession.user = updated
  return updated
}

export async function completePendingOnboarding(user: SessionUser): Promise<OnboardingResult | null> {
  const pending = getPendingOnboarding()
  if (!pending) return null
  if (pending.email !== user.email.trim().toLowerCase()) {
    throw new Error('Inicia sesión con el mismo correo que usaste durante el registro para completar la configuración.')
  }

  let updatedUser = await acceptTerms(user, pending.termsVersion || FALLBACK_TERMS_VERSION)
  const name = `${pending.firstName} ${pending.lastName}`.trim()
  if (name && name !== updatedUser.name) {
    const profileRes = await authorizedFetch(`/v1/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    if (!profileRes.ok) throw new Error(await responseError(profileRes, 'No fue posible completar tu perfil'))
    updatedUser = parseUser(await profileRes.json())
    if (memorySession) memorySession.user = updatedUser
  }

  if (pending.invitationCode) {
    const invitationRes = await authorizedFetch('/v1/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: pending.invitationCode }),
    })
    if (!invitationRes.ok) throw new Error(await responseError(invitationRes, 'La invitación no pudo aceptarse'))
  }

  clearPendingOnboarding()
  return { invitationAccepted: Boolean(pending.invitationCode), user: updatedUser }
}
