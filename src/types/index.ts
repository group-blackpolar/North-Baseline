export type JobStatus = 'idle' | 'running' | 'done'

// ── Usuarios (real — CoreCrow-API GET /v1/users) ───────────────────────
export interface ApiUser {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'DEVELOPER' | 'ADMIN' | 'SUPERADMIN'
  emailVerified: boolean
  createdAt: string
}

// ── Notas y Tareas (mock — pendiente de endpoints en CoreCrow-API) ─────
export interface Workspace {
  id: string
  nombre: string
  miembros: string[]
}

export interface NoteOrTask {
  id: string
  workspaceId: string
  tipo: 'nota' | 'tarea'
  titulo: string
  contenido: string
  hecha?: boolean
  compartidaCon: string[]
  actualizada: string
}

// ── Logs (mock) ─────────────────────────────────────────────────────────
export interface LogEntry {
  id: string
  nivel: 'info' | 'warn' | 'error'
  origen: string
  mensaje: string
  timestamp: string
}

// ── Estado de API (parcialmente real: /api/health sí existe) ───────────
export interface EndpointHealth {
  path: string
  label: string
  status: 'up' | 'down' | 'checking'
  latencyMs: number | null
}

// ── API Keys (mock — modelo ApiKey ya existe en Prisma, sin rutas aún) ─
export interface ApiKeyEntry {
  id: string
  name: string
  prefix: string
  owner: string
  scopes: string[]
  lastUsed: string | null
  createdAt: string
}

// ── CI/CD (mock — pendiente integrar GitHub Actions API) ───────────────
export interface DeployStatus {
  app: string
  workflow: string
  status: 'success' | 'failed' | 'running'
  commit: string
  timestamp: string
}

// ── Auditoría (mock) ─────────────────────────────────────────────────────
export interface AuditEvent {
  id: string
  actor: string
  accion: string
  recurso: string
  timestamp: string
}
