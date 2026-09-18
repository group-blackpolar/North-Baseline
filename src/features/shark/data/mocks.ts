import type { SharkRecord } from './types';

/** Dataset demo inspirado en el reporte legacy de SHARK (Looker Studio).
 *  Determinista: mismo seed → mismos números en cada carga. */

export const PORTS = [
  'Manzanillo International',
  'Panama Ports Balboa',
  'Colon Container Terminal',
  'PSA Panama',
  'Panama Ports Cristobal',
];

export const CARRIERS = ['Maersk', 'MSC', 'COSCO Shipping', 'CMA CGM', 'Hapag-Lloyd', 'Evergreen'];

export const COUNTRIES = [
  'China',
  'United States of America',
  'Colombia',
  'Mexico',
  'Guatemala',
  'Korea (Republic of)',
  'Spain',
  'Hong Kong',
  'Brazil',
  'Belgium',
];

export const CONSIGNEES = [
  'ETERNITY INTL',
  'KRYSTAL LOGISTICS',
  'DHL',
  'CAPITAL PACIFICO S.A.',
  'AGENCIAS FEDURO S.A',
  'KUEHNE NAGEL',
  'PRIC SMART PANAMA',
  'JAG TRANSPORTS',
  'ALONSO FORWARDING P.',
  'FAITH EXP S.A',
  'COCHEZ Y CIA.',
  'CASA BEES B.T. MAYANI',
  'GENERAL CARGO S.A.',
  'PIER17',
  'NESTLE PANAMA S.A.',
  'NOUR ZONA LIBRE',
];

export const YEARS = [2024, 2025, 2026];
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Pesos para que los charts se vean realistas (China y Maersk dominan). */
const COUNTRY_WEIGHTS = [0.38, 0.14, 0.08, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.03];
const CARRIER_WEIGHTS = [0.32, 0.14, 0.13, 0.12, 0.11, 0.09];
const PORT_WEIGHTS = [0.39, 0.27, 0.19, 0.09, 0.06];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(random: () => number, items: string[], weights: number[]): string {
  const roll = random();
  let acc = 0;
  for (let i = 0; i < items.length; i += 1) {
    acc += weights[i];
    if (roll <= acc) return items[i];
  }
  return items[items.length - 1];
}

function buildRecords(): SharkRecord[] {
  const random = mulberry32(20260618);
  const records: SharkRecord[] = [];

  for (const year of YEARS) {
    // 2026 solo hasta junio (dataset "updated through June 2026")
    const maxMonth = year === 2026 ? 6 : 12;
    for (let month = 1; month <= maxMonth; month += 1) {
      for (const port of PORTS) {
        for (const carrier of CARRIERS) {
          const country = pickWeighted(random, COUNTRIES, COUNTRY_WEIGHTS);
          const consignee = CONSIGNEES[Math.floor(random() * CONSIGNEES.length)];
          const portWeight = PORT_WEIGHTS[PORTS.indexOf(port)];
          const carrierWeight = CARRIER_WEIGHTS[CARRIERS.indexOf(carrier)];
          const seasonality = 1 + 0.22 * Math.sin((month / 12) * Math.PI * 2);
          const yearGrowth = year === 2024 ? 0.85 : year === 2025 ? 1 : 0.95;
          const base = 260000 * portWeight * carrierWeight * seasonality * yearGrowth;
          const containers = Math.max(120, Math.round(base * (0.75 + random() * 0.5)));
          records.push({
            year,
            month,
            port,
            carrier,
            consignee,
            country,
            containers,
            teus: Math.round(containers * (1.75 + random() * 0.35)),
          });
        }
      }
    }
  }
  return records;
}

export const SHARK_RECORDS: SharkRecord[] = buildRecords();