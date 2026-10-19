import { Anchor, Boat, ChartLineUp, Package, Stack, Truck, Warehouse } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import type { Dictionary } from '@/lib/i18n';

/**
 * A report is a NORTH category whose slug is `slug`; CORECROW decides, per caller, whether it is allowed, restricted or not configured
 * (GET /organizations/:id/report-access). This file is only presentation: names, icons, a colour and which crop of the port photo to use.
 */
export type ReportDefinition = {
  slug: string;
  nameKey: keyof Dictionary;
  descriptionKey: keyof Dictionary;
  icon: IconComponent;
  /** Accent as a theme token reference (`var(--chart-N)`), never a literal colour. Moderate use: icon, top edge and the action. */
  accent: string;
  /** Photo shipped under /brand/cards (credits in CREDITS.md next to it). */
  image: string;
};

const SHARK_REPORTS: ReportDefinition[] = [
  { slug: 'local-import', nameKey: 'oh.r.local-import.name', descriptionKey: 'oh.r.local-import.desc', icon: Package, accent: 'var(--chart-1)', image: '/brand/cards/local-import.webp' },
  { slug: 'local-export', nameKey: 'oh.r.local-export.name', descriptionKey: 'oh.r.local-export.desc', icon: Truck, accent: 'var(--chart-6)', image: '/brand/cards/local-export.webp' },
  { slug: 'import-ctr', nameKey: 'oh.r.import-ctr.name', descriptionKey: 'oh.r.import-ctr.desc', icon: ChartLineUp, accent: 'var(--chart-4)', image: '/brand/cards/import-ctr.webp' },
  { slug: 'master-house', nameKey: 'oh.r.master-house.name', descriptionKey: 'oh.r.master-house.desc', icon: Stack, accent: 'var(--chart-2)', image: '/brand/cards/master-house.webp' },
  { slug: 'free-zone-import', nameKey: 'oh.r.free-zone-import.name', descriptionKey: 'oh.r.free-zone-import.desc', icon: Warehouse, accent: 'var(--chart-3)', image: '/brand/cards/free-zone-import.webp' },
  { slug: 'free-zone-export', nameKey: 'oh.r.free-zone-export.name', descriptionKey: 'oh.r.free-zone-export.desc', icon: Boat, accent: 'var(--chart-5)', image: '/brand/cards/free-zone-export.webp' },
  { slug: 'maritime-export', nameKey: 'oh.r.maritime-export.name', descriptionKey: 'oh.r.maritime-export.desc', icon: Anchor, accent: 'var(--chart-7)', image: '/brand/cards/maritime-export.webp' },
];

/** Organizations with a curated Home, keyed by organization slug. Every other organization gets a Home built from its real navigation. */
export const CURATED_REPORTS: Record<string, { productName: string; reports: ReportDefinition[] }> = {
  shark: { productName: 'Shark', reports: SHARK_REPORTS },
};

export const GENERIC_ACCENTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
export const GENERIC_IMAGES = SHARK_REPORTS.map((report) => report.image);
