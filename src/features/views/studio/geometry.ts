// DOM measurement for the canvas. Grid tracks are `minmax(2rem, auto)` (same as the published page), so row heights are
// uneven; the browser's resolved `grid-template-rows` gives the real used sizes, which is what pointer maths needs.
import type { GridMetrics } from './grid';

const px = (value: string) => { const parsed = parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; };

export function readMetrics(grid: HTMLElement): GridMetrics {
  const style = getComputedStyle(grid);
  const tracks = style.gridTemplateRows === 'none' ? [] : style.gridTemplateRows.split(' ').map(px).filter((value) => value > 0);
  return { width: grid.clientWidth, gap: px(style.rowGap), tracks };
}
