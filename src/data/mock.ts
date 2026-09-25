import type {
  Workspace,
  NoteOrTask,
  LogEntry,
  ApiKeyEntry,
  DeployStatus,
  AuditEvent,
} from '@/types'

// Todo lo de este archivo es data de ejemplo — sirve para maquetar el panel
// mientras CoreCrow-API expone los endpoints reales de cada uno.

export const WORKSPACES: Workspace[] = [
  { id: 'ws-1', nombre: 'Black Polar — General', miembros: ['cosmic', 'dev.ana', 'dev.luis'] },
  { id: 'ws-2', nombre: 'North (este panel)', miembros: ['cosmic', 'dev.ana'] },
  { id: 'ws-3', nombre: 'CoreCrow-API', miembros: ['cosmic', 'dev.luis'] },
]

export const NOTES_TASKS: NoteOrTask[] = [
  {
    id: 'nt-1', workspaceId: 'ws-2', tipo: 'tarea',
    titulo: 'Implementar rutas de ApiKey en CoreCrow-API', contenido: 'create/list/revoke + scopes',
    hecha: false, compartidaCon: ['dev.luis'], actualizada: 'hace 2h',
  },
  {
    id: 'nt-2', workspaceId: 'ws-2', tipo: 'nota',
    titulo: 'Convención de nombres de workflows', contenido: 'deploy-web, deploy-north, deploy-api',
    compartidaCon: [], actualizada: 'ayer',
  },
  {
    id: 'nt-3', workspaceId: 'ws-1', tipo: 'tarea',
    titulo: 'Revisar certificados Origin de Cloudflare', contenido: 'expiran cada 15 años, no urgente',
    hecha: true, compartidaCon: ['dev.ana', 'dev.luis'], actualizada: 'hace 3 días',
  },
]

export const LOGS: LogEntry[] = [
  { id: 'l-1', nivel: 'info', origen: 'north', mensaje: 'Login exitoso', timestamp: 'hace 2m' },
  { id: 'l-2', nivel: 'warn', origen: 'api', mensaje: 'Rate limit cerca del límite (92/100)', timestamp: 'hace 14m' },
  { id: 'l-3', nivel: 'error', origen: 'api', mensaje: 'GET /v1/users → 500 (timeout de DB)', timestamp: 'hace 1h' },
  { id: 'l-4', nivel: 'info', origen: 'mainsite', mensaje: 'Deploy de blackpolar.org completado', timestamp: 'hace 3h' },
]

export const API_KEYS: ApiKeyEntry[] = [
  { id: 'k-1', name: 'North (servidor)', prefix: 'bp_live_9f2a', owner: 'cosmic', scopes: ['read:users', 'read:health'], lastUsed: 'hace 5m', createdAt: '2026-07-01' },
  { id: 'k-2', name: 'Integración externa (demo)', prefix: 'bp_live_a01c', owner: 'dev.ana', scopes: ['read:health'], lastUsed: null, createdAt: '2026-07-10' },
]

export const DEPLOYS: DeployStatus[] = [
  { app: 'blackpolar (mainsite)', workflow: 'deploy-web', status: 'success', commit: 'd6c5b17', timestamp: 'hace 40m' },
  { app: 'CoreCrow-API', workflow: 'deploy-api', status: 'success', commit: '9a11c02', timestamp: 'hace 2h' },
  { app: 'North', workflow: 'deploy-north', status: 'running', commit: '3fe881a', timestamp: 'ahora' },
]

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'a-1', actor: 'cosmic', accion: 'login', recurso: 'north', timestamp: 'hace 2m' },
  { id: 'a-2', actor: 'dev.ana', accion: 'creó nota', recurso: 'workspace:North', timestamp: 'hace 1h' },
  { id: 'a-3', actor: 'dev.luis', accion: 'cambió rol a ADMIN', recurso: 'user:dev.ana', timestamp: 'ayer' },
]

export const REVENUE_SAMPLE = [
  { mes: 'Feb', ingresos: 4200, clientes: 12 },
  { mes: 'Mar', ingresos: 5100, clientes: 15 },
  { mes: 'Abr', ingresos: 4800, clientes: 16 },
  { mes: 'May', ingresos: 6200, clientes: 19 },
  { mes: 'Jun', ingresos: 7100, clientes: 22 },
  { mes: 'Jul', ingresos: 7800, clientes: 24 },
]
