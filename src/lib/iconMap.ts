import {
  Accessibility,
  Activity,
  Bell,
  ChartBar,
  Database,
  GitBranch,
  Key,
  Languages,
  LayoutDashboard,
  NotebookText,
  Palette,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Mapa canónico de iconos por nombre (catálogos, rail, sidebar, tabs). */
export const ICON_MAP: Record<string, LucideIcon> = {
  layout: LayoutDashboard,
  user: User,
  users: Users,
  chart: ChartBar,
  shield: Shield,
  'shield-check': ShieldCheck,
  settings: Settings,
  scroll: ScrollText,
  branch: GitBranch,
  db: Database,
  pulse: Activity,
  key: Key,
  note: NotebookText,
  palette: Palette,
  languages: Languages,
  bell: Bell,
  accessibility: Accessibility,
  wrench: Wrench,
};

export function resolveIcon(name?: string): LucideIcon {
  return ICON_MAP[name ?? ''] ?? LayoutDashboard;
}