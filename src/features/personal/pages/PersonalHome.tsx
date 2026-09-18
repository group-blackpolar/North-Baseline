import { Building2, FileText, FileSpreadsheet, Presentation as FilePresentation, FileArchive, Laptop, Smartphone, Monitor, Plus, Zap } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { DashboardCard, MetricCard } from '@/components/dashboard/primitives';
import { TrendLineChart } from '@/components/dashboard/charts';
import { personalService } from '../data/service';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const FILE_ICONS = {
  doc: FileText,
  sheet: FileSpreadsheet,
  deck: FilePresentation,
  pdf: FileArchive,
} as const;

const DEVICE_ICONS = {
  Desktop: Monitor,
  Laptop: Laptop,
  Mobile: Smartphone,
} as const;

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-active overflow-hidden">
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PersonalHome({ user }: { user: SessionUser }) {
  const { organizations, switchOrganization } = useOrganization();
  const { navigate } = useTabs();

  const activity = personalService.activity();
  const files = personalService.files();
  const notifications = personalService.notifications();
  const sessions = personalService.sessions();
  const usage = personalService.usage();
  const trend = personalService.usageTrend();

  const orgs = organizations.filter((org) => org.id !== 'personal');

  return (
    <div className="p-6 space-y-4">
      {/* Welcome */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">{user.name ?? user.email}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {/* TODO(i18n): TASK-09 */}
            Tu espacio personal: actividad, archivos y sesiones en un solo lugar.
          </p>
        </div>
        <button
          type="button"
          className="h-9 px-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-1.5 transition-colors duration-150"
          onClick={() => navigate('home', 'quick-actions')}
        >
          <Zap className="w-4 h-4" />
          Quick actions
        </button>
      </header>

      {/* KPIs + Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="PROYECTOS ACTIVOS" value={String(usage.activeProjects)} />
        <MetricCard label="ARCHIVOS RECIENTES" value={String(files.length)} />
        <MetricCard label="SESIONES" value={String(sessions.length)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Activity trend (mini chart) */}
        <DashboardCard title="Actividad semanal" description="Acciones y sesiones de los últimos 7 días." className="xl:col-span-2">
          <TrendLineChart
            data={trend}
            series={[{ key: 'actions', color: 'var(--color-accent)' }, { key: 'logins', color: '#60A5FA' }]}
            height={180}
          />
        </DashboardCard>

        {/* Usage */}
        <DashboardCard title="Uso" description="Cuota del plan Free.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Almacenamiento</span>
                <span className="mono-data text-text">{usage.storageUsedGb} / {usage.storageQuotaGb} GB</span>
              </div>
              <ProgressBar value={usage.storageUsedGb} max={usage.storageQuotaGb} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Llamadas API (mes)</span>
                <span className="mono-data text-text">{usage.apiCallsMonth} / {usage.apiCallsQuota}</span>
              </div>
              <ProgressBar value={usage.apiCallsMonth} max={usage.apiCallsQuota} />
            </div>
          </div>
        </DashboardCard>

        {/* Recent activity (timeline) */}
        <DashboardCard title="Actividad reciente" description="Tus últimos movimientos." className="xl:col-span-2">
          <ol className="relative space-y-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
            {activity.map((item) => (
              <li key={item.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface bg-accent" />
                <p className="text-sm text-text font-medium">{item.title}</p>
                <p className="text-xs text-text-secondary">{item.detail} · {item.timestamp}</p>
              </li>
            ))}
          </ol>
        </DashboardCard>

        {/* Notifications */}
        <DashboardCard title="Notificaciones" description={`${notifications.filter((n) => !n.read).length} sin leer`}>
          <ul className="space-y-3">
            {notifications.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <span className={cn('mt-1.5 size-2 rounded-full shrink-0', item.read ? 'bg-border-strong' : 'bg-accent')} />
                <div className="min-w-0">
                  <p className="text-sm text-text font-medium truncate">{item.title}</p>
                  <p className="text-xs text-text-secondary truncate">{item.body}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{item.timestamp}</p>
                </div>
              </li>
            ))}
          </ul>
        </DashboardCard>

        {/* Recent files */}
        <DashboardCard title="Archivos recientes" description="Últimos documentos abiertos.">
          <ul className="space-y-2">
            {files.map((file) => {
              const Icon = FILE_ICONS[file.kind];
              return (
                <li key={file.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors duration-150">
                  <div className="size-8 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text font-medium truncate">{file.name}</p>
                    <p className="text-xs text-text-secondary truncate">{file.workspace} · {file.updatedAt}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </DashboardCard>

        {/* Organizations */}
        <DashboardCard title="Organizaciones" description="Workspaces a los que perteneces.">
          <ul className="space-y-2">
            {orgs.map((org) => {
              const initials = (org as { initials?: string }).initials ?? (org.name ?? '?').slice(0, 2).toUpperCase();
              return (
                <li key={org.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors duration-150 text-left"
                    onClick={() => switchOrganization(org.id)}
                  >
                    <div className="size-8 rounded-lg bg-surface-active flex items-center justify-center font-display text-xs font-semibold text-text-secondary shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text font-medium truncate">{org.name}</p>
                      <p className="text-xs text-text-secondary truncate">{(org as { description?: string }).description ?? 'Organization'}</p>
                    </div>
                    <Building2 className="w-4 h-4 text-text-muted shrink-0" />
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 p-2 rounded-lg border border-dashed border-border-strong text-text-muted hover:text-accent hover:border-accent transition-colors duration-150 text-sm"
                onClick={() => switchOrganization(orgs[0]?.id ?? 'personal')}
              >
                <Plus className="w-4 h-4" />
                Explorar workspaces
              </button>
            </li>
          </ul>
        </DashboardCard>

        {/* Recent sessions */}
        <DashboardCard title="Sesiones recientes" description="Dispositivos con acceso activo.">
          <ul className="space-y-2">
            {sessions.map((session) => {
              const Icon = DEVICE_ICONS[session.device as keyof typeof DEVICE_ICONS] ?? Monitor;
              return (
                <li key={session.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors duration-150">
                  <div className="size-8 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text font-medium truncate">
                      {session.device} · {session.browser}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{session.location} · {session.lastActive}</p>
                  </div>
                  {session.current && (
                    <span className="rounded-full bg-accent-soft text-accent text-[10px] font-semibold px-2 py-0.5 shrink-0">Actual</span>
                  )}
                </li>
              );
            })}
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}