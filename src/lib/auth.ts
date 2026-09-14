// Cliente de sesión contra CoreCrow-API (Better Auth), el mismo backend
// real que usa blackpolar.org — así el login es "único" de verdad: la
// misma cuenta funciona en el mainsite y aquí en North.
//
// Better Auth expone /api/auth/* (sign-in/email, sign-up/email,
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
  role: 'USER' | 'ADMIN'
}

// En desktop no hay cookie de navegador — guardamos la sesión en memoria
// del proceso (nunca en localStorage) para el resto de las llamadas.
let memorySession: { token: string; user: SessionUser } | null = null


async function betterAuthFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}/api/auth${path}`, {
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
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? 'Credenciales inválidas')
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

export function loginWithGoogle() {
  window.location.href = `${API_URL}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(window.location.origin)}`
}
