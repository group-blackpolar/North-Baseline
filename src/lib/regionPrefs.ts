/** Preferencias de región y formatos. Hoy localStorage;
 *  TODO: sincronizar con CoreCrow → User Preferences. */

export interface RegionPrefs {
  region: string;
  dateFormat: string;
  timeFormat: string;
}

const KEY = 'north-region-prefs-v1';

const DEFAULTS: RegionPrefs = {
  region: 'PA',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

export function getRegionPrefs(): RegionPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULTS, ...(raw as Partial<RegionPrefs>) };
  } catch {
    /* storage no disponible */
  }
  return { ...DEFAULTS };
}

export function saveRegionPrefs(prefs: RegionPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage no disponible */
  }
}