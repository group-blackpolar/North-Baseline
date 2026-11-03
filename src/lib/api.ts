import { authHeaders } from '@/lib/auth'
import { getInspection, inspectionHeadersFor } from '@/lib/inspection'
import { askReason, getReason, reasonHeaders, REASON_REQUIRED_CODE } from '@/lib/platformReason'
import { apiCache, tagsForPath, tagsInvalidatedByWrite, type CachePolicy } from '@/lib/apiCache'

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

async function send(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      // Fastify rejects a JSON content type with an empty body (bodyless POST/DELETE), so only declare it with a body.
      ...(init?.body === undefined || init?.body === null ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...inspectionHeadersFor(path, init?.method),
      ...(isWrite(init?.method) ? reasonHeaders() : {}),
      ...(init?.headers ?? {}),
    },
  })
}

const isWrite = (method?: string) => !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await send(path, init)
  // ADR-0002: an operator without membership must justify a write. Ask once, then retry (the refused request changed nothing).
  if (response.status === 403 && isWrite(init?.method) && !getReason() && (await response.clone().json().catch(() => null))?.error?.code === REASON_REQUIRED_CODE && (await askReason())) {
    response = await send(path, init)
  }

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

  // A successful write makes cached reads of its tenant stale: edits, publication, role/permission changes, deletion.
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') tagsInvalidatedByWrite(path).forEach((tag) => apiCache.invalidateTag(tag))

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * Memory-cached GET (see apiCache.ts): deduplicated, optionally stale-while-revalidate, invalidated by any write to the
 * same organization. Use only for read-mostly resources; CORECROW still authorizes every request that reaches it.
 */
export function cachedGet<T>(path: string, policy: CachePolicy, options?: { force?: boolean }): Promise<T> {
  const key = `${getInspection()?.id ?? ''}|${path}`
  return apiCache.get<T>(key, () => apiRequest<T>(path), { ...policy, tags: [...tagsForPath(path), ...(policy.tags ?? [])] }, options)
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
}