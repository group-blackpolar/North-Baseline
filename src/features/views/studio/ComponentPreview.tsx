import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChartBar, ChartDonut, ChartLine, Database, WarningCircle } from '@phosphor-icons/react';
import { AnalyticsBarChart, AnalyticsDataGrid, AnalyticsDonutChart, AnalyticsKpi, AnalyticsLineAreaChart } from '@/features/analytics/AnalyticsVisuals';
import { datasetQueryToAnalyticsResult } from '@/features/analytics/datasetQueryAdapters';
import type { DatasetQueryResponse } from '@/features/analytics/datasetQuery';
import { publishedBarChartProps, publishedDonutChartProps, publishedLineChartProps, publishedMetricField } from '@/features/analytics/publishedVisualProps';
import type { AnalyticsResult } from '@/features/analytics/types';
import { useI18n } from '@/lib/i18n';
import { SafeComponent } from '@/views/ViewsRenderer';
import { BindingSourceProvider } from '@/features/analytics/pro/bindingSource';
import { ProComponent } from '@/features/analytics/pro/ProComponent';
import { makePreviewSource } from './previewSource';
import type { Component } from './documentOps';
import { cachedQuery } from './previewCache';
import { ANALYTICS_TYPES, DATA_BINDING_KEY, isChart } from './registry';
import type { PanelBinding } from './studioApi';

const localizedOf = (value: unknown, locales: string[]): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return String(locales.map((locale) => record[locale]).find((entry) => typeof entry === 'string') ?? Object.values(record).find((entry) => typeof entry === 'string') ?? '');
};


function useBindingPreview(organizationId: string, binding: PanelBinding | undefined) {
  const [state, setState] = useState<{ result: AnalyticsResult; response: DatasetQueryResponse | null }>({ result: { state: 'loading' }, response: null });
  const queryKey = binding ? `${binding.datasetId}:${JSON.stringify(binding.query)}` : null;
  useEffect(() => {
    if (!binding) return;
    let alive = true;
    setState({ result: { state: 'loading' }, response: null });
    cachedQuery(organizationId, binding)
      .then((response) => { if (alive) setState({ result: datasetQueryToAnalyticsResult(response), response }); })
      .catch((reason: unknown) => { if (alive) setState({ result: { state: 'error', message: reason instanceof Error ? reason.message : undefined }, response: null }); });
    return () => { alive = false; };
    // The binding object may be re-created by a list refresh; only its dataset + query matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, queryKey]);
  return state;
}

const ICONS = { bar_chart: ChartBar, line_chart: ChartLine, donut_chart: ChartDonut } as const;

function Notice({ icon: Glyph, tone = 'muted', children }: { icon: typeof Database; tone?: 'muted' | 'warning'; children: ReactNode }) {
  return (
    <div className={`flex min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs ${tone === 'warning' ? 'border-warning/50 text-warning' : 'border-border text-text-muted'}`}>
      <Glyph className="size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function BoundContent({ organizationId, component, binding, locales }: { organizationId: string; component: Component; binding: PanelBinding; locales: string[] }) {
  const { t } = useI18n();
  const { result, response } = useBindingPreview(organizationId, binding);
  const keys = useMemo(() => new Set(response?.columns.map((column) => column.key) ?? []), [response]);
  const props = component.props;
  const title = localizedOf(props.title, locales);
  const withTitle = (chart: ReactNode) => <div className="space-y-2">{title ? <h3 className="text-sm font-medium text-text">{title}</h3> : null}{chart}</div>;
  if (component.type === 'metric') {
    const field = publishedMetricField(props, keys);
    if (field) return <AnalyticsKpi result={result} field={field} label={localizedOf(props.label, locales) || field} />;
    if (response) return <Notice icon={WarningCircle} tone="warning">{t('st.preview.fieldMissing')}</Notice>;
  }
  if (component.type === 'bar_chart') {
    const config = publishedBarChartProps(props, keys, locales);
    if (config) return withTitle(<AnalyticsBarChart result={result} {...config} />);
    if (response) return <Notice icon={WarningCircle} tone="warning">{t('st.preview.fieldMissing')}</Notice>;
  }
  if (component.type === 'line_chart') {
    const config = publishedLineChartProps(props, keys, locales);
    if (config) return withTitle(<AnalyticsLineAreaChart result={result} {...config} />);
    if (response) return <Notice icon={WarningCircle} tone="warning">{t('st.preview.fieldMissing')}</Notice>;
  }
  if (component.type === 'donut_chart') {
    const config = publishedDonutChartProps(props, keys);
    if (config) return withTitle(<AnalyticsDonutChart result={result} {...config} />);
    if (response) return <Notice icon={WarningCircle} tone="warning">{t('st.preview.fieldMissing')}</Notice>;
  }
  return <AnalyticsDataGrid result={result} />;
}

export interface ComponentPreviewProps {
  organizationId: string;
  component: Component;
  locales: string[];
  bindings: ReadonlyArray<PanelBinding>;
  /** The editor draws data from the binding's declared query (the caller is authorized to query datasets). */
  live: boolean;
}

/** One component, rendered the way the published page renders it; bound components show their real data. */
export const ComponentPreview = memo(function ComponentPreview({ organizationId, component, locales, bindings, live }: ComponentPreviewProps) {
  const { t } = useI18n();
  const previewSource = useMemo(() => makePreviewSource(organizationId, bindings), [bindings, organizationId]);
  if (component.type === 'filter_bar') return <Notice icon={Database}>{t('st.preview.filterBar')}</Notice>;
  if (ANALYTICS_TYPES.has(component.type)) {
    const attached = Object.values(component.bindings).some((item) => (item as { sourceType?: string })?.sourceType === 'dataset');
    if (!attached) return <Notice icon={ChartBar}>{t('st.preview.unbound')}</Notice>;
    if (!live) return <Notice icon={Database}>{t('st.preview.boundGeneric')}</Notice>;
    return <BindingSourceProvider source={previewSource}><ProComponent component={component} panelKey="studio-preview" locales={locales} /></BindingSourceProvider>;
  }
  const reference = component.bindings[DATA_BINDING_KEY] as { sourceType?: string; sourceId?: string } | undefined;
  const datasetRef = reference?.sourceType === 'dataset' ? reference : Object.values(component.bindings).find((item) => (item as { sourceType?: string })?.sourceType === 'dataset') as { sourceId?: string } | undefined;
  if (datasetRef?.sourceId) {
    const binding = bindings.find((item) => item.id === datasetRef.sourceId);
    if (!binding) return <Notice icon={WarningCircle} tone="warning">{t('st.preview.bindingMissing')}</Notice>;
    if (!live) return <Notice icon={Database}>{t('st.preview.bound', { name: binding.name })}</Notice>;
    return <BoundContent organizationId={organizationId} component={component} binding={binding} locales={locales} />;
  }
  if (isChart(component.type)) {
    const Glyph = ICONS[component.type as keyof typeof ICONS];
    return <Notice icon={Glyph}>{t('st.preview.unbound')}</Notice>;
  }
  if (component.type === 'document_workspace') return <Notice icon={Database}>{t('st.preview.documents')}</Notice>;
  return <>{SafeComponent({ type: component.type, props: component.props, locales })}</>;
});
