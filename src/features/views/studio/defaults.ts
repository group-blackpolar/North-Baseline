// Default `props` for every component type. Each default is valid against CORECROW's strict component schema (so an
// autosave of a freshly added component can never be rejected) and contains NO sample data: metrics have no value,
// charts point at placeholder keys until the Data tab maps them to a binding's real columns, tables have no rows.
// Framework-free (no path aliases) so templates and tests can use it directly.

import type { ComponentType } from '@/lib/northAdmin';
import { makeId } from './documentOps.ts';

const localized = (text: string) => ({ es: text, en: text });

export function defaultProps(type: ComponentType): Record<string, unknown> {
  switch (type) {
    case 'heading': return { text: localized('Título'), level: 2, align: 'left' };
    case 'rich_text': return { documents: { es: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto' }] }] }, en: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] } } };
    case 'image': case 'video': case 'file': return { assetId: '' };
    case 'link': return { label: localized('Enlace'), href: 'https://example.com' };
    case 'table': return { columns: [{ key: 'value', label: localized('Valor') }], rows: [] };
    case 'card': return { title: localized('Tarjeta') };
    case 'list': return { items: [{ id: makeId(), text: localized('Elemento') }] };
    case 'metric': return { label: localized('Indicador'), format: 'number' };
    case 'divider': return { variant: 'solid', spacing: 'md' };
    case 'embed': return { url: 'https://www.youtube.com/', title: localized('Embed') };
    // Charts start with schema-valid placeholder keys so autosave never fails; they only render once the Data tab maps them to a
    // binding's real columns, and the publish check reports any chart that is still unbound.
    case 'bar_chart': return { title: localized('Gráfico de barras'), categoryKey: 'category', series: [{ key: 'value', label: localized('Valor') }], height: 280, variant: 'grouped' };
    case 'line_chart': return { title: localized('Gráfico de líneas'), categoryKey: 'category', series: [{ key: 'value', label: localized('Valor') }], height: 280, variant: 'line' };
    case 'donut_chart': return { title: localized('Distribución'), categoryKey: 'category', valueKey: 'value', height: 280, variant: 'donut' };
    case 'document_workspace': return { typeKey: 'form' };
    // Analytics components start unmapped; the Data tab maps their keys to the real columns of the attached binding.
    case 'kpi_card': return { label: localized('Indicador'), valueKey: 'value', format: 'number', icon: 'chart', tone: 'blue', variant: 'standard' };
    case 'data_grid': return { title: localized('Resultados'), columns: [{ key: 'value', label: localized('Valor'), kind: 'text' }], pageSizes: [10, 20, 50], defaultPageSize: 20, searchable: true, selectable: false, exportable: true };
    case 'geo_map': return { title: localized('Distribución por país'), regionKey: 'region', valueKey: 'value' };
    case 'insights': return { title: localized('Insights'), items: [{ id: makeId(), rule: 'leader_share', binding: 'data', labelKey: 'label', valueKey: 'value', title: localized('Líder del ranking') }] };
    case 'filter_bar': return { title: localized('Filtros') };
  }
}
