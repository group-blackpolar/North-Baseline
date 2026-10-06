import { ChartBar, Database, Gear, GitBranch, Key, Note, Pulse, Scroll, ShieldCheck, SquaresFour, User, Users } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';

const REGISTRY: Record<string, IconComponent> = {
  layout: SquaresFour,
  note: Note,
  user: User,
  users: Users,
  shield: ShieldCheck,
  settings: Gear,
  scroll: Scroll,
  branch: GitBranch,
  db: Database,
  pulse: Pulse,
  key: Key,
  chart: ChartBar,
};

const FALLBACK: IconComponent = SquaresFour;

export function resolveIcon(name: string): IconComponent {
  return REGISTRY[name] ?? FALLBACK;
}