import { useEffect, useState } from 'react'
import { Login } from '@/views/Login'
import { Sidebar, type ViewId } from '@/views/Sidebar'
import { TopBar } from '@/views/TopBar'
import { NotesTasksView } from '@/views/NotesTasksView'
import { UsersAdminView } from '@/views/UsersAdminView'
import { DashboardsView } from '@/views/DashboardsView'
import { LogsView } from '@/views/LogsView'
import { ApiHealthView } from '@/views/ApiHealthView'
import { ApiKeysView } from '@/views/ApiKeysView'
import { CiCdView } from '@/views/CiCdView'
import { AuditoriaView } from '@/views/AuditoriaView'
import { DbBackupsView } from '@/views/DbBackupsView'
import { PlaceholderView } from '@/views/PlaceholderView'
import { getSession, logout, type SessionUser } from '@/lib/auth'
import { isTauri } from '@/lib/tauri'


const TITLES: Record<ViewId, string> = {
  'notas-tareas': 'Notas y Tareas',
  usuarios: 'Usuarios',
  dashboards: 'Paneles',
  logs: 'Registros',
  'api-health': 'Estado de API',
  'api-keys': 'Claves de API',
  cicd: 'CI/CD',
  auditoria: 'Auditoría',
  'db-backups': 'Base de Datos',
  config: 'Configuración',
  perfil: 'Perfil',
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(!isTauri())
  const [active, setActive] = useState<ViewId>('notas-tareas')

  useEffect(() => {
    if (isTauri()) {
      setCheckingSession(false)
      return
    }
    getSession().then(setUser).finally(() => setCheckingSession(false))
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
    setActive('notas-tareas')
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg text-text-dim font-display text-xs">
        Verificando sesión…
      </div>
    )
  }

  if (!user) return <Login onSuccess={setUser} />

  return (
    <div className="h-screen w-screen flex bg-bg">
      <Sidebar active={active} setActive={setActive} user={user} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={TITLES[active]} breadcrumb={active} />
        <div className="flex-1 overflow-y-auto">
          {active === 'notas-tareas' && <NotesTasksView />}
          {active === 'usuarios' && <UsersAdminView />}
          {active === 'dashboards' && <DashboardsView />}
          {active === 'logs' && <LogsView />}
          {active === 'api-health' && <ApiHealthView />}
          {active === 'api-keys' && <ApiKeysView />}
          {active === 'cicd' && <CiCdView />}
          {active === 'auditoria' && <AuditoriaView />}
          {active === 'db-backups' && <DbBackupsView />}
          {active === 'config' && <PlaceholderView label="configuración general" />}
          {active === 'perfil' && <PlaceholderView label="perfil de usuario" />}
        </div>
      </div>
    </div>
  )
}
