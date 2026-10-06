import type { ReactNode } from 'react';
import { useShellMode } from '@/lib/responsive';

/** Same data, two presentations: `table` on tablet/desktop, stacked cards on phone. Analytic tables that must stay tabular keep their own horizontal scroll instead. */
export function ResponsiveList<T>({ items, getKey, renderCard, table }: { items: T[]; getKey: (item: T) => string; renderCard: (item: T) => ReactNode; table: ReactNode }) {
  if (useShellMode() !== 'phone') return <>{table}</>;
  return <ul className="space-y-2">{items.map((item) => <li key={getKey(item)}>{renderCard(item)}</li>)}</ul>;
}
