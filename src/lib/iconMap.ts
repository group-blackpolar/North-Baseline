import { Bell, Boat, ChartBar, Database, FileText, Folder, Gear, GitBranch, Key, Notebook, Palette, PersonSimpleCircle, PlugsConnected, Pulse, Receipt, Scroll, Shield, ShieldCheck, SquaresFour, Stack, Translate, User, Users, Wrench } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';

/** Mapa canónico de iconos por nombre (catálogos, rail, sidebar, tabs). */
export const ICON_MAP: Record<string, IconComponent> = {
  layout: SquaresFour,
  user: User,
  users: Users,
  chart: ChartBar,
  shield: Shield,
  'shield-check': ShieldCheck,
  settings: Gear,
  scroll: Scroll,
  branch: GitBranch,
  db: Database,
  database: Database,
  stack: Stack,
  plug: PlugsConnected,
  receipt: Receipt,
  pulse: Pulse,
  key: Key,
  note: Notebook,
  palette: Palette,
  languages: Translate,
  bell: Bell,
  accessibility: PersonSimpleCircle,
  wrench: Wrench,
  // Names stored by CORECROW navigation (compared case-insensitively).
  ship: Boat,
  folder: Folder,
  filetext: FileText,
};

export function resolveIcon(name?: string): IconComponent {
  return ICON_MAP[(name ?? '').toLowerCase()] ?? SquaresFour;
}