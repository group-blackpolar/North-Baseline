import { SHARK_RECORDS } from './mocks';
import type { PortFilters, PortReport } from './type';

/** Única puerta de datos SHARK. Hoy mock; mañana BigQuery/CoreCrow sin tocar la UI. */
export const sharkService = {
  portReport(filters: PortFilters): PortReport {
    const rows = SHARK_RECORDS.filter((record) =>
      (filters.port === 'all' || record.port === filters.port) &&
      (filters.year === 'all' || record.year === Number(filters.year)) &&
      (filters.carrier === 'all' || record.carrier === filters.carrier) &&
      (filters.month === 'all' || record.month === Number(filters.month))
    );
    const aggregate = (key: (row: (typeof rows)[number]) => string) => {
      const map = new Map<string, { containers: number; teus: number }>();
      for (const row of rows) {
        const bucket = map.get(key(row)) ?? { containers: 0, teus: 0 };
        bucket.containers += row.containers;
        bucket.teus += row.teus;
        map.set(key(row), bucket);
      }
      return [...map.entries()].map(([label, value]) => ({ label, ...value }));
    };
    const monthly = aggregate((row) => `${row.year}-${String(row.month).padStart(2, '0')}`)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-12)
      .map((entry) => ({ label: entry.label, containers: entry.containers }));
    const byPort = aggregate((row) => row.port).sort((a, b) => b.containers - a.containers);
    const byCarrier = aggregate((row) => row.carrier).sort((a, b) => b.containers - a.containers);
    const consignees = aggregate((row) => row.consignee).sort((a, b) => b.containers - a.containers);
    const total = rows.reduce((sum, row) => sum + row.containers, 0) || 1;
    return {
      containers: rows.reduce((sum, row) => sum + row.containers, 0),
      teus: rows.reduce((sum, row) => sum + row.teus, 0),
      monthly,
      byPort,
      byCarrier,
      topConsignees: consignees.slice(0, 6).map((entry) => ({ label: entry.label, containers: entry.containers, teus: entry.teus, share: entry.containers / total })),
    };
  },
};