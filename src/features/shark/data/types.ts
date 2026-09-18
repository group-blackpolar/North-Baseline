/** Modelo de datos SHARK. Hoy mock; mañana BigQuery/CoreCrow sin tocar la UI. */

export interface SharkRecord {
  year: number;
  month: number; // 1-12
  port: string; // puerto de entrada (Panamá)
  carrier: string; // línea / agencia
  consignee: string;
  country: string; // país de origen
  containers: number;
  teus: number;
}

export interface SharkFilters {
  port: string; // 'all' | nombre
  carrier: string;
  consignee: string;
  country: string;
  year: string; // 'all' | '2024' | '2025' | '2026'
  month: string; // 'all' | '1'..'12'
}

export const EMPTY_FILTERS: SharkFilters = {
  port: 'all',
  carrier: 'all',
  consignee: 'all',
  country: 'all',
  year: 'all',
  month: 'all',
};

/** NOTE: type alias (no interface) para que sea asignable a SeriesRow
 *  (Record<string, number | string>) vía implicit index signature. */
export type AggEntry = {
  label: string;
  containers: number;
  teus: number;
};

/** Fila para charts multi-serie: { label, '2024': n, '2025': n, '2026': n } */
export type SeriesRow = Record<string, number | string>;

export interface PortReport {
  containers: number;
  teus: number;
  monthlyByYear: SeriesRow[]; // tendencia mensual con serie por año
  byPort: AggEntry[];
  byCarrier: AggEntry[];
  byCountry: AggEntry[];
  topConsignees: Array<AggEntry & { share: number }>;
}

export interface YearComparisonReport {
  byYear: Array<{ label: string; containers: number }>;
  byYearPort: SeriesRow[]; // { label: year, [port]: containers }
  byMonthYear: SeriesRow[]; // { label: month, [year]: containers }
  byRegionYear: SeriesRow[]; // { label: country, [year]: containers } (top 8)
}

export interface ConsigneeReport {
  containers: number;
  teus: number;
  byEntryPort: AggEntry[];
  byLine: AggEntry[];
  byMonth: SeriesRow[];
  byCountry: Array<AggEntry & { share: number }>;
}