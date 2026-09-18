import { CARRIERS, CONSIGNEES, COUNTRIES, MONTH_LABELS, PORTS, SHARK_RECORDS, YEARS } from './mocks';
import type {
  AggEntry,
  ConsigneeReport,
  PortReport,
  SeriesRow,
  SharkFilters,
  SharkRecord,
  YearComparisonReport,
} from './types';

/** Única puerta de datos SHARK. Sustituible por sharkBigQueryService() o CoreCrow
 *  sin tocar ninguna vista: las páginas solo consumen estos reportes. */

function applyFilters(records: SharkRecord[], filters: SharkFilters): SharkRecord[] {
  return records.filter(
    (record) =>
      (filters.port === 'all' || record.port === filters.port) &&
      (filters.carrier === 'all' || record.carrier === filters.carrier) &&
      (filters.consignee === 'all' || record.consignee === filters.consignee) &&
      (filters.country === 'all' || record.country === filters.country) &&
      (filters.year === 'all' || record.year === Number(filters.year)) &&
      (filters.month === 'all' || record.month === Number(filters.month))
  );
}

function aggregate(records: SharkRecord[], key: (row: SharkRecord) => string): AggEntry[] {
  const map = new Map<string, AggEntry>();
  for (const row of records) {
    const label = key(row);
    const bucket = map.get(label) ?? { label, containers: 0, teus: 0 };
    bucket.containers += row.containers;
    bucket.teus += row.teus;
    map.set(label, bucket);
  }
  return [...map.values()].sort((a, b) => b.containers - a.containers);
}

function totals(records: SharkRecord[]) {
  return records.reduce(
    (acc, row) => ({ containers: acc.containers + row.containers, teus: acc.teus + row.teus }),
    { containers: 0, teus: 0 }
  );
}

/** Serie mensual con una columna por año: { label: 'Jan', 2024: n, 2025: n, 2026: n } */
function monthlyByYear(records: SharkRecord[]): SeriesRow[] {
  return MONTH_LABELS.map((label, index) => {
    const row: SeriesRow = { label };
    for (const year of YEARS) {
      row[String(year)] = records
        .filter((r) => r.month === index + 1 && r.year === year)
        .reduce((sum, r) => sum + r.containers, 0);
    }
    return row;
  });
}

function withShare(entries: AggEntry[], total: number) {
  return entries.map((entry) => ({ ...entry, share: total > 0 ? entry.containers / total : 0 }));
}

export const sharkService = {
  /** Opciones para los FilterSelect de todas las vistas. */
  options: { ports: PORTS, carriers: CARRIERS, countries: COUNTRIES, consignees: CONSIGNEES, years: YEARS },

  portReport(filters: SharkFilters): PortReport {
    const rows = applyFilters(SHARK_RECORDS, filters);
    const sum = totals(rows);
    const consignees = aggregate(rows, (r) => r.consignee);
    return {
      containers: sum.containers,
      teus: sum.teus,
      monthlyByYear: monthlyByYear(rows),
      byPort: aggregate(rows, (r) => r.port),
      byCarrier: aggregate(rows, (r) => r.carrier),
      byCountry: aggregate(rows, (r) => r.country).slice(0, 8),
      topConsignees: withShare(consignees.slice(0, 8), sum.containers),
    };
  },

  yearComparison(filters: SharkFilters): YearComparisonReport {
    const rows = applyFilters(SHARK_RECORDS, filters);

    const byYear = YEARS.map((year) => ({
      label: String(year),
      containers: rows.filter((r) => r.year === year).reduce((sum, r) => sum + r.containers, 0),
    }));

    const byYearPort: SeriesRow[] = YEARS.map((year) => {
      const row: SeriesRow = { label: String(year) };
      for (const port of PORTS) {
        row[port] = rows
          .filter((r) => r.year === year && r.port === port)
          .reduce((sum, r) => sum + r.containers, 0);
      }
      return row;
    });

    const byMonthYear = monthlyByYear(rows);

    const topCountries = aggregate(rows, (r) => r.country).slice(0, 8);
    const byRegionYear: SeriesRow[] = topCountries.map((entry) => {
      const row: SeriesRow = { label: entry.label };
      for (const year of YEARS) {
        row[String(year)] = rows
          .filter((r) => r.country === entry.label && r.year === year)
          .reduce((sum, r) => sum + r.containers, 0);
      }
      return row;
    });

    return { byYear, byYearPort, byMonthYear, byRegionYear };
  },

  consigneeReport(filters: SharkFilters): ConsigneeReport {
    const rows = applyFilters(SHARK_RECORDS, filters);
    const sum = totals(rows);
    return {
      containers: sum.containers,
      teus: sum.teus,
      byEntryPort: aggregate(rows, (r) => r.port),
      byLine: aggregate(rows, (r) => r.carrier),
      byMonth: monthlyByYear(rows),
      byCountry: withShare(aggregate(rows, (r) => r.country).slice(0, 10), sum.containers),
    };
  },
};