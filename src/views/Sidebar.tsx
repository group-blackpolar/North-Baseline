import { useEffect, useRef, useState } from 'react'
import type { SessionUser } from '@/lib/auth'

const ITEMS = [
  { id: 'notas-tareas', label: 'Notas y Tareas', icon: '☰' },
  { id: 'usuarios', label: 'Usuarios', icon: '◍' },
  { id: 'dashboards', label: 'Paneles', icon: '◫' },
  { id: 'logs', label: 'Registros', icon: '▤' },
  { id: 'api-health', label: 'Estado de API', icon: '◉' },
  { id: 'api-keys', label: 'Claves de API', icon: '⚿' },
  { id: 'cicd', label: 'CI/CD', icon: '⇄' },
  { id: 'auditoria', label: 'Auditoría', icon: '◒' },
  { id: 'db-backups', label: 'Base de Datos', icon: '⛁' },
  { id: 'config', label: 'Configuración', icon: '⚙' },
] as const

// 'perfil' no vive en la nav principal — solo se llega ahí desde el menú de usuario
export type ViewId = (typeof ITEMS)[number]['id'] | 'perfil'

export function Sidebar({
  active,
  setActive,
  user,
  onLogout,
}: {
  active: ViewId
  setActive: (id: ViewId) => void
  user: SessionUser | null
  onLogout: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

      <div ref={menuRef} className="relative px-3 py-3 border-t border-line">
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-md border border-line bg-panel shadow-lg overflow-hidden">
            <button
              onClick={() => {
                setActive('perfil')
                setMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-panel-2 transition-colors"
            >
              Perfil
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                onLogout()
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-panel-2 transition-colors border-t border-line"
            >
              Cerrar sesión
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-panel-2 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-panel-2 border border-line flex items-center justify-center text-xs font-mono shrink-0">
            {(user?.name ?? user?.email ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-xs min-w-0 text-left flex-1">
            <div className="truncate">{user?.name ?? user?.email ?? 'invitado'}</div>
            <div className="text-text-dim font-mono text-[10px]">{user?.role === 'ADMIN' ? 'admin' : 'usuario'}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-dim">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
