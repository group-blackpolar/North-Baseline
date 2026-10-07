import { authHeaders } from '@/lib/auth'
import { inspectionHeadersFor } from '@/lib/inspection'

export const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? 'https://api.blackpolar.org')

export class ApiError extends Error {
  status: number
  code?: string
  requestId?: string
  constructor(status: number, message: string, code?: string, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      // Fastify rejects a JSON content type with an empty body (bodyless POST/DELETE), so only declare it with a body.
      ...(init?.body === undefined || init?.body === null ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...inspectionHeadersFor(path, init?.method),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = response.statusText
    let code: string | undefined
    let requestId: string | undefined
    try {
      const body = await response.json()
      message = body?.error?.message ?? message
      code = body?.error?.code
      requestId = body?.error?.requestId
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(response.status, message, code, requestId)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}