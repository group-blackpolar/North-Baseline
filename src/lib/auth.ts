// Cliente de sesión contra CoreCrow-API (Better Auth), el mismo backend
// real que usa blackpolar.org — así el login es "único" de verdad: la
// misma cuenta funciona en el mainsite y aquí en North.
//
// Better Auth expone /v1/auth/* (sign-in/email, sign-up/email,
// get-session, sign-out, etc.) — ver CoreCrow-API/src/server.ts y
// src/lib/auth.ts. La sesión viaja por cookie (credentials: 'include')
// en web; en desktop (Tauri) no hay cookie de navegador compartida, así
// que ahí usamos el mismo login por credenciales contra el mismo backend
// (misma cuenta, sesión propia del proceso, guardada solo en memoria).

import { isTauri } from './tauri'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.blackpolar.org'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'DEVELOPER' | 'ADMIN' | 'SUPERADMIN'
}

// En desktop no hay cookie de navegador — guardamos la sesión en memoria
// del proceso (nunca en localStorage) para el resto de las llamadas.
let memorySession: { token: string; user: SessionUser } | null = null
let memoryOnboarding: PendingOnboarding | null = null

const PENDING_ONBOARDING_KEY = 'north-pending-onboarding-v1'

export interface PendingOnboarding {
  firstName: string
  lastName: string
  email: string
  invitationCode?: string
}

export interface OnboardingResult {
  invitationAccepted: boolean
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

export function savePendingOnboarding(data: PendingOnboarding) {
  const normalized: PendingOnboarding = {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    ...(data.invitationCode
      ? { invitationCode: data.invitationCode.trim().toLowerCase() }
      : {}),
  }
  if (isTauri()) memoryOnboarding = normalized
  else sessionStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(normalized))
}

function readPendingOnboarding(): PendingOnboarding | null {
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


async function betterAuthFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}/v1/auth${path}`, {
    ...options,
    credentials: isTauri() ? 'omit' : 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(memorySession ? { Authorization: `Bearer ${memorySession.token}` } : {}),
      ...options.headers,
    },
  })
  return res
}

export async function loginWithAdminId(adminUniqueId: string, email?: string): Promise<SessionUser> {
  const payload: Record<string, string> = { adminUniqueId: adminUniqueId.trim() }
  if (email?.trim()) {
    payload.email = email.trim()
  }

  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Admin ID inválido')
  }

  const data = await res.json()
  const user: SessionUser = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name ?? null,
    role: data.user.role ?? 'ADMIN',
  }

  // /api/admin/login no setea cookie — guardamos el token de sesión en
  // memoria tanto en web como en desktop.
  memorySession = { token: data.session.token, user }
  return user
}

// ¿Ya existe algún admin? Si no, hay que crearlo primero con initAdmin().
export async function adminExists(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/admin/exists`)
  if (!res.ok) return true // ante la duda, no ofrecer el formulario de creación
  const data = await res.json()
  return Boolean(data.exists)
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await betterAuthFetch('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(await responseError(res, 'Credenciales inválidas'))
  }

  const data = await res.json()
  const user: SessionUser = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name ?? null,
    role: data.user.role ?? 'USER',
  }

  if (isTauri()) {
    memorySession = { token: data.token, user }
  }

  return user
}

export async function signUpWithEmail(input: {
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<void> {
  const res = await betterAuthFetch('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      name: `${input.firstName.trim()} ${input.lastName.trim()}`,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      callbackURL: window.location.origin,
    }),
  })

  if (!res.ok) {
    throw new Error(await responseError(res, 'No fue posible crear la cuenta'))
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const res = await betterAuthFetch('/get-session')
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.user) return null
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name ?? null,
      role: data.user.role ?? 'USER',
    }
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  await betterAuthFetch('/sign-out', { method: 'POST' }).catch(() => {})
  memorySession = null
}
export function currentToken() {
  return memorySession?.token ?? null
}

export async function loginWithGoogle(options: { requestSignUp?: boolean } = {}) {
  if (isTauri()) {
    throw new Error('Google estará disponible en escritorio cuando el callback seguro de North esté configurado.')
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
  if (!res.ok) {
    throw new Error(await responseError(res, 'No fue posible continuar con Google'))
  }
  const data = await res.json()
  if (!data?.url) throw new Error('Google no devolvió una URL de autorización')
  window.location.assign(data.url)
}

export async function completePendingOnboarding(user: SessionUser): Promise<OnboardingResult | null> {
  const pending = readPendingOnboarding()
  if (!pending) return null
  if (pending.email !== user.email.trim().toLowerCase()) {
    throw new Error('Inicia sesión con el mismo correo que usaste durante el registro para completar la configuración.')
  }

  const name = `${pending.firstName} ${pending.lastName}`.trim()
  if (name && name !== user.name) {
    const profileRes = await fetch(`${API_URL}/v1/users/${user.id}`, {
      method: 'PATCH',
      credentials: isTauri() ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(memorySession ? { Authorization: `Bearer ${memorySession.token}` } : {}),
      },
      body: JSON.stringify({ name }),
    })
    if (!profileRes.ok) {
      throw new Error(await responseError(profileRes, 'No fue posible completar tu perfil'))
    }
  }

  if (pending.invitationCode) {
    const invitationRes = await fetch(`${API_URL}/v1/invitations/accept`, {
      method: 'POST',
      credentials: isTauri() ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(memorySession ? { Authorization: `Bearer ${memorySession.token}` } : {}),
      },
      body: JSON.stringify({ token: pending.invitationCode }),
    })
    if (!invitationRes.ok) {
      throw new Error(await responseError(invitationRes, 'La invitación no pudo aceptarse'))
    }
  }

  clearPendingOnboarding()
  return { invitationAccepted: Boolean(pending.invitationCode) }
}
