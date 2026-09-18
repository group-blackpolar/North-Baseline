/** Mocks del Personal Workspace.
 *  TODO: sustituir por CoreCrow (Activity / Files / Sessions / Preferences). */

export interface ActivityItem {
  id: string;
  kind: 'file' | 'session' | 'org' | 'edit';
  title: string;
  detail: string;
  timestamp: string;
}

export interface RecentFile {
  id: string;
  name: string;
  kind: 'doc' | 'sheet' | 'deck' | 'pdf';
  workspace: string;
  updatedAt: string;
}

export interface SessionItem {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
}

export interface UsageStats {
  storageUsedGb: number;
  storageQuotaGb: number;
  apiCallsMonth: number;
  apiCallsQuota: number;
  activeProjects: number;
}

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'a1', kind: 'edit', title: 'Editaste Q3-imports.xlsx', detail: 'SHARK Workspace · Master House', timestamp: 'Hace 12 min' },
  { id: 'a2', kind: 'session', title: 'Inicio de sesión nuevo', detail: 'Chrome · Windows · Panamá', timestamp: 'Hace 1 h' },
  { id: 'a3', kind: 'file', title: 'Subiste port-analysis.pdf', detail: 'SHARK Workspace · Report Info', timestamp: 'Hace 3 h' },
  { id: 'a4', kind: 'org', title: 'Te uniste a SHARK', detail: 'Invitación aceptada', timestamp: 'Ayer' },
  { id: 'a5', kind: 'edit', title: 'Actualizaste tu perfil', detail: 'Nombre y biografía', timestamp: 'Hace 2 días' },
  { id: 'a6', kind: 'file', title: 'Creaste notes-demo.doc', detail: 'Personal Workspace', timestamp: 'Hace 4 días' },
];

export const MOCK_FILES: RecentFile[] = [
  { id: 'f1', name: 'Q3-imports.xlsx', kind: 'sheet', workspace: 'SHARK', updatedAt: 'Hace 12 min' },
  { id: 'f2', name: 'port-analysis.pdf', kind: 'pdf', workspace: 'SHARK', updatedAt: 'Hace 3 h' },
  { id: 'f3', name: 'notes-demo.doc', kind: 'doc', workspace: 'Personal', updatedAt: 'Hace 4 días' },
  { id: 'f4', name: 'demo-deck.ppt', kind: 'deck', workspace: 'Personal', updatedAt: 'Hace 1 sem' },
];

export const MOCK_SESSIONS: SessionItem[] = [
  { id: 's1', device: 'Desktop', browser: 'Chrome 129', os: 'Windows 11', ip: '186.12.••.••', location: 'Panamá', lastActive: 'Ahora', current: true },
  { id: 's2', device: 'Laptop', browser: 'Firefox 130', os: 'macOS 15', ip: '186.12.••.••', location: 'Panamá', lastActive: 'Hace 2 días', current: false },
  { id: 's3', device: 'Mobile', browser: 'Safari iOS 18', os: 'iOS 18', ip: '190.44.••.••', location: 'Panamá', lastActive: 'Hace 6 días', current: false },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: 'Invitación a organización', body: 'Fuiste invitado a SHARK Maritime.', read: false, timestamp: 'Ayer' },
  { id: 'n2', title: 'Cambio de contraseña', body: 'Tu contraseña fue actualizada correctamente.', read: true, timestamp: 'Hace 3 días' },
  { id: 'n3', title: 'Nuevo dispositivo', body: 'Se detectó un inicio de sesión nuevo.', read: true, timestamp: 'Hace 1 sem' },
];

export const MOCK_USAGE: UsageStats = {
  storageUsedGb: 3.4,
  storageQuotaGb: 10,
  apiCallsMonth: 1240,
  apiCallsQuota: 5000,
  activeProjects: 2,
};

/** Serie de actividad de los últimos 7 días para el mini chart. */
export const MOCK_USAGE_TREND: Array<Record<string, number | string>> = [
  { label: 'Lu', actions: 14, logins: 2 },
  { label: 'Ma', actions: 22, logins: 3 },
  { label: 'Mi', actions: 9, logins: 1 },
  { label: 'Ju', actions: 31, logins: 4 },
  { label: 'Vi', actions: 26, logins: 3 },
  { label: 'Sa', actions: 6, logins: 1 },
  { label: 'Do', actions: 11, logins: 2 },
];