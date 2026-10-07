import { useShellMode } from '@/lib/responsive';

/** Width of the category axis in horizontal bar charts: narrower on phone so bars keep room. */
export const useLabelAxisWidth = () => (useShellMode() === 'phone' ? 84 : 120);
