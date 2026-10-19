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
  /** Secondary accent (hex). Moderate use: icon, top edge and the action. */
  accent: string;
  /** Crop of the shared port photo (object-position + zoom) so each card reads differently without extra assets. */
  crop: { position: string; scale: number };
};

const SHARK_REPORTS: ReportDefinition[] = [
  { slug: 'local-import', nameKey: 'oh.r.local-import.name', descriptionKey: 'oh.r.local-import.desc', icon: Package, accent: '#22D3EE', crop: { position: '12% 78%', scale: 1.9 } },
  { slug: 'local-export', nameKey: 'oh.r.local-export.name', descriptionKey: 'oh.r.local-export.desc', icon: Truck, accent: '#2DD4BF', crop: { position: '42% 82%', scale: 2.1 } },
  { slug: 'import-ctr', nameKey: 'oh.r.import-ctr.name', descriptionKey: 'oh.r.import-ctr.desc', icon: ChartLineUp, accent: '#A78BFA', crop: { position: '82% 42%', scale: 1.7 } },
  { slug: 'master-house', nameKey: 'oh.r.master-house.name', descriptionKey: 'oh.r.master-house.desc', icon: Stack, accent: '#60A5FA', crop: { position: '68% 66%', scale: 1.6 } },
  { slug: 'free-zone-import', nameKey: 'oh.r.free-zone-import.name', descriptionKey: 'oh.r.free-zone-import.desc', icon: Warehouse, accent: '#FBBF24', crop: { position: '25% 62%', scale: 2.2 } },
  { slug: 'free-zone-export', nameKey: 'oh.r.free-zone-export.name', descriptionKey: 'oh.r.free-zone-export.desc', icon: Boat, accent: '#FB7185', crop: { position: '96% 88%', scale: 1.8 } },
  { slug: 'maritime-export', nameKey: 'oh.r.maritime-export.name', descriptionKey: 'oh.r.maritime-export.desc', icon: Anchor, accent: '#818CF8', crop: { position: '52% 50%', scale: 1.5 } },
];

/** Organizations with a curated Home, keyed by organization slug. Every other organization gets a Home built from its real navigation. */
export const CURATED_REPORTS: Record<string, { productName: string; reports: ReportDefinition[] }> = {
  shark: { productName: 'Shark', reports: SHARK_REPORTS },
};

export const GENERIC_ACCENTS = ['#22D3EE', '#2DD4BF', '#A78BFA', '#60A5FA', '#FBBF24', '#FB7185', '#818CF8'];
export const GENERIC_CROPS = SHARK_REPORTS.map((report) => report.crop);
