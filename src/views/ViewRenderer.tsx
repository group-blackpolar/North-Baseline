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
import { HomeView } from './HomeView';
import { PersonalView } from '@/features/personal/PersonalView';
import { SharkView } from '@/features/shark/SharkView';

const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences']);
const SHARK_CATEGORIES = new Set(['shark-home', 'master-house']);

export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  // 🐛 DEBUG: log de lo que llega
  console.log('[ViewRenderer] tab completa:', JSON.stringify(tab, null, 2));

  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
        Usa el botón + de la barra de pestañas para abrir una vista
      </div>
    );
  }

  if (PERSONAL_CATEGORIES.has(tab.route.categoryId)) {
    console.log('[ViewRenderer] → PersonalView');
    return <PersonalView route={tab.route} user={user} />;
  }
  if (SHARK_CATEGORIES.has(tab.route.categoryId)) {
    console.log('[ViewRenderer] → SharkView con categoryId:', tab.route.categoryId);
    return <SharkView route={tab.route} />;
  }

  console.log('[ViewRenderer] → switch legacy, viewId:', tab.viewId);
  switch (tab.viewId as string) {
    case 'home': return <HomeView />;
    case 'billing': return <div className="p-6 text-text-secondary">Billing en construcción</div>;
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
      return (
        <div className="p-6 text-text-dim text-sm">
          <p>Vista en construcción: {tabTitle(tab)}</p>
          <pre className="mt-4 text-xs bg-surface-hover p-3 rounded overflow-x-auto">
            {JSON.stringify(tab, null, 2)}
          </pre>
        </div>
      );
  }
}