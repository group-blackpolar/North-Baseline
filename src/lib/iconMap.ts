import { SquaresFour } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import { catalogEntry } from '@/lib/iconCatalog';

/** Icon for a stored name (catalogs, rail, sidebar, tabs). Unknown or empty names get the neutral grid. */
export function resolveIcon(name?: string | null): IconComponent {
  return catalogEntry(name)?.icon ?? SquaresFour;
}
