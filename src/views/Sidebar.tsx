import type { SessionUser } from '@/lib/auth'

const ITEMS = [
  { id: 'notas-tareas', label: 'Notas y Tareas', icon: '☰' },
  { id: 'usuarios', label: 'Usuarios', icon: '◍' },
  { id: 'dashboards', label: 'Dashboards', icon: '◫' },
  { id: 'logs', label: 'Logs', icon: '▤' },
  { id: 'api-health', label: 'Estado de API', icon: '◉' },
  { id: 'api-keys', label: 'API Keys', icon: '⚿' },
  { id: 'cicd', label: 'CI/CD', icon: '⇄' },
  { id: 'auditoria', label: 'Auditoría', icon: '◒' },
  { id: 'db-backups', label: 'Base de Datos', icon: '⛁' },
  { id: 'config', label: 'Configuración', icon: '⚙' },
] as const

export type ViewId = (typeof ITEMS)[number]['id']

export function Sidebar({
  active,
  setActive,
  user,
}: {
  active: ViewId
  setActive: (id: ViewId) => void
  user: SessionUser | null
}) {
  return (
    <div className="w-56 shrink-0 border-r border-line bg-panel flex flex-col">
      <div className="px-5 py-5 border-b border-line flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-accent/15 border border-accent/40 flex items-center justify-center text-accent font-display font-bold text-xs">
          N
        </div>
        <span className="font-display tracking-[0.2em] text-xs text-text-dim">NORTH</span>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            onClick={() => setActive(it.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2 ${
              active === it.id
                ? 'border-accent text-text bg-panel-2'
                : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            <span className="font-mono text-base w-4 text-center">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-line flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-panel-2 border border-line flex items-center justify-center text-xs font-mono">
          {(user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="text-xs min-w-0">
          <div className="truncate">{user?.name ?? user?.email ?? 'invitado'}</div>
          <div className="text-text-dim font-mono text-[10px]">{user?.role === 'ADMIN' ? 'admin' : 'usuario'}</div>
        </div>
      </div>
    </div>
  )
}
