import type { SessionUser } from '@/lib/auth';
import { tabTitle, type Tab } from '@/context/TabsContext';
import { NotesTasksView } from '@/views/NotesTasksView';
import { UsersAdminView } from '@/views/UsersAdminView';
import { DashboardsView } from '@/views/DashboardsView';
import { LogsView } from '@/views/LogsView';
import { ApiHealthView } from '@/views/ApiHealthView';
import { ApiKeysView } from '@/views/ApiKeysView';
import { CiCdView } from '@/views/CiCdView';
import { AuditoriaView } from '@/views/AuditoriaView';
import { DbBackupsView } from '@/views/DbBackupsView';
import { ProfileView } from '@/views/ProfileView';
import { SettingsView } from './SettingsView';


export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Usa el botón + de la barra de pestañas para abrir una vista
      </div>
    );
  }
  switch (tab.viewId) {
    case 'notas-tareas': return <NotesTasksView />;
    case 'usuarios': return <UsersAdminView />;
    case 'dashboards': return <DashboardsView />;
    case 'logs': return <LogsView />;
    case 'api-health': return <ApiHealthView />;
    case 'api-keys': return <ApiKeysView />;
    case 'cicd': return <CiCdView />;
    case 'auditoria': return <AuditoriaView />;
    case 'db-backups': return <DbBackupsView />;
    case 'perfil': return <ProfileView user={user} />;
    case 'settings': return <SettingsView />;
    default:
      return <div className="p-6 text-text-dim text-sm">Vista en construcción: {tabTitle(tab)}</div>;
  }
}