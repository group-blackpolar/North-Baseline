import { useEffect, useState } from 'react';

/** Interface density (UX-01b). "auto" picks by viewport width; the others are explicit. */
export type DensityPreference = 'auto' | 'comfortable' | 'standard' | 'compact';
export type Density = Exclude<DensityPreference, 'auto'>;
/** Motion: "system" follows the OS setting, "reduced" forces minimal animation inside NORTH. */
export type MotionPreference = 'system' | 'reduced';

const DENSITY_KEY = 'north-density-v1';
const MOTION_KEY = 'north-motion-v1';
/** Below this width the compact scale applies automatically (validated with real use, see UX-01a). */
export const AUTO_COMPACT_BELOW = 1280;

export function resolveDensity(preference: DensityPreference, viewportWidth: number): Density {
  if (preference !== 'auto') return preference;
  return viewportWidth < AUTO_COMPACT_BELOW ? 'compact' : 'standard';
}

const read = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  } catch {
    /* storage no disponible */
  }
  return fallback;
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage no disponible */
  }
};

export const getDensityPreference = () => read<DensityPreference>(DENSITY_KEY, ['auto', 'comfortable', 'standard', 'compact'], 'auto');
export const getMotionPreference = () => read<MotionPreference>(MOTION_KEY, ['system', 'reduced'], 'system');

/** Sets html[data-density] and html[data-motion]; the tokens in index.css do the rest. */
export function applyDensity(preference: DensityPreference): void {
  document.documentElement.dataset.density = resolveDensity(preference, window.innerWidth);
  write(DENSITY_KEY, preference);
}
export function applyMotion(preference: MotionPreference): void {
  document.documentElement.dataset.motion = preference;
  write(MOTION_KEY, preference);
}

export function useDensity() {
  const [density, setDensity] = useState<DensityPreference>(() => getDensityPreference());
  useEffect(() => {
    applyDensity(density);
    if (density !== 'auto') return;
    const onResize = () => applyDensity('auto');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [density]);
  return { density, setDensity, resolved: resolveDensity(density, typeof window === 'undefined' ? AUTO_COMPACT_BELOW : window.innerWidth) };
}

export function useMotion() {
  const [motion, setMotion] = useState<MotionPreference>(() => getMotionPreference());
  useEffect(() => applyMotion(motion), [motion]);
  return { motion, setMotion };
}
