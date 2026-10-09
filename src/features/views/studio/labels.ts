import type { Dictionary } from '@/lib/i18n';
import type { StudioCategory } from './registry';

// Typed lookups so every label key is checked against the dictionary at compile time.
const LABELS: Record<string, keyof Dictionary> = {
  heading: 'st.cmp.heading', rich_text: 'st.cmp.rich_text', card: 'st.cmp.card', link: 'st.cmp.link', list: 'st.cmp.list', divider: 'st.cmp.divider',
  metric: 'st.cmp.metric', bar_chart: 'st.cmp.bar_chart', line_chart: 'st.cmp.line_chart', donut_chart: 'st.cmp.donut_chart', table: 'st.cmp.table',
  embed: 'st.cmp.embed', image: 'st.cmp.image', video: 'st.cmp.video', file: 'st.cmp.file', document_workspace: 'st.cmp.document_workspace',
  kpi_card: 'st.cmp.kpi_card', data_grid: 'st.cmp.data_grid', geo_map: 'st.cmp.geo_map', insights: 'st.cmp.insights', filter_bar: 'st.cmp.filter_bar',
};
const HINTS: Record<string, keyof Dictionary> = {
  heading: 'st.cmp.heading.hint', rich_text: 'st.cmp.rich_text.hint', card: 'st.cmp.card.hint', link: 'st.cmp.link.hint', list: 'st.cmp.list.hint', divider: 'st.cmp.divider.hint',
  metric: 'st.cmp.metric.hint', bar_chart: 'st.cmp.bar_chart.hint', line_chart: 'st.cmp.line_chart.hint', donut_chart: 'st.cmp.donut_chart.hint', table: 'st.cmp.table.hint',
  embed: 'st.cmp.embed.hint', image: 'st.cmp.image.hint', video: 'st.cmp.video.hint', file: 'st.cmp.file.hint', document_workspace: 'st.cmp.document_workspace.hint',
  kpi_card: 'st.cmp.kpi_card.hint', data_grid: 'st.cmp.data_grid.hint', geo_map: 'st.cmp.geo_map.hint', insights: 'st.cmp.insights.hint', filter_bar: 'st.cmp.filter_bar.hint',
};
const CATEGORIES: Record<StudioCategory, keyof Dictionary> = {
  layout: 'st.cat.layout', content: 'st.cat.content', metrics: 'st.cat.metrics', charts: 'st.cat.charts', data: 'st.cat.data', advanced: 'st.cat.advanced',
};

export const componentLabelKey = (type: string): keyof Dictionary => LABELS[type] ?? 'st.cmp.unknown';
export const componentHintKey = (type: string): keyof Dictionary => HINTS[type] ?? 'st.cmp.unknown';
export const categoryLabelKey = (category: StudioCategory): keyof Dictionary => CATEGORIES[category];
