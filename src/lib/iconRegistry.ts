import {
  Activity, BarChart3, Database, GitBranch, KeyRound, LayoutDashboard,
  ScrollText, Settings, ShieldCheck, StickyNote, UserRound, Users,
  type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  layout: LayoutDashboard,
  note: StickyNote,
  user: UserRound,
  users: Users,
  shield: ShieldCheck,
  settings: Settings,
  scroll: ScrollText,
  branch: GitBranch,
  db: Database,
  pulse: Activity,
  key: KeyRound,
  chart: BarChart3,
};

const FALLBACK: LucideIcon = LayoutDashboard;

export function resolveIcon(name: string): LucideIcon {
  return REGISTRY[name] ?? FALLBACK;
}