import type { SharkRecord } from './type';

/** Mock determinista. TODO: sustituir por sharkBigQueryService() / CoreCrow API. */
export const PORTS = ['Balboa', 'Cristóbal', 'PSA Panama', 'Colon Container Terminal'];
export const CARRIERS = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'Evergreen'];
export const COUNTRIES = ['China', 'South Korea', 'Japan', 'USA', 'Germany'];
export const CONSIGNEES = ['La Casa Del Tornillo', 'Supermercados Rey', 'Distribuidora Riba Smith', 'Panama Trading Co.', 'Comercial El Sol', 'Grupo Elektra PA'];
export const YEARS = [2024, 2025, 2026];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260918);

export const SHARK_RECORDS: SharkRecord[] = YEARS.flatMap((year) =>
  Array.from({ length: year === 2026 ? 9 : 12 }, (_, monthIndex) => monthIndex + 1).flatMap((month) =>
    PORTS.flatMap((port) =>
      CARRIERS.slice(0, 3).map((carrier, carrierIndex) => {
        const consignee = CONSIGNEES[Math.floor(random() * CONSIGNEES.length)];
        const country = CARRIERS.indexOf(carrier) % 2 === 0 ? COUNTRIES[carrierIndex % COUNTRIES.length] : COUNTRIES[Math.floor(random() * COUNTRIES.length)];
        const base = 3000 + random() * 9000;
        const seasonality = 1 + 0.25 * Math.sin((month / 12) * Math.PI * 2);
        const containers = Math.round(base * seasonality);
        return { year, month, port, carrier, consignee, country, containers, teus: Math.round(containers * (1.7 + random() * 0.4)) };
      })
    )
  )
);