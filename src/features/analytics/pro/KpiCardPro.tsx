import { ArrowDown, ArrowUp, Equals, WarningCircle } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { analyticsRows, bindingIdOf, comparisonRows, useBindingResult } from './bindingSource';
import { asNumber, deltaOf, formatValue, localizedText, relativeDay, TONE_VARS, toneOf, type ValueFormat } from './format';
import { iconOf } from './icons';

type Props = Record<string, unknown>;
type Subtitle = { mode: 'text'; text: unknown } | { mode: 'share'; valueKey: string; totalKey: string; label?: unknown } | { mode: 'relative_date' };

const FORMATS = new Set<ValueFormat>(['number', 'decimal', 'percent', 'text', 'date', 'month']);

/**
 * KPI Card Pro. Reads `data` (and `total` for share subtitles). Trend and comparison appear only when CORECROW returned a
 * previous-period result for the reader's selected range; with no comparable period no change is shown or implied.
 */
export function KpiCardPro({ props, bindings, locales }: { props: Props; bindings: Record<string, unknown>; locales: string[] }) {
  const { t, locale } = useI18n();
  const dataId = bindingIdOf(bindings, 'data');
  const totalId = bindingIdOf(bindings, 'total');
  const valueKey = typeof props.valueKey === 'string' ? props.valueKey : '';
  const format = FORMATS.has(props.format as ValueFormat) ? props.format as ValueFormat : 'number';
  const decimals = typeof props.decimals === 'number' ? props.decimals : undefined;
  const subtitle = props.subtitle as Subtitle | undefined;
  const comparison = props.comparison as { label?: unknown; inverse?: boolean } | undefined;
  const variant = (['compact', 'standard', 'trend', 'comparison'] as const).find((item) => item === props.variant) ?? 'standard';
  const wantsComparison = Boolean(comparison) && variant !== 'compact';

  const data = useBindingResult(dataId, wantsComparison ? { compare: true } : {});
  const total = useBindingResult(subtitle?.mode === 'share' ? totalId : null);

  const label = localizedText(props.label, locales);
  const unit = localizedText(props.unit, locales);
  const tone = TONE_VARS[toneOf(props.tone)];
  const Glyph = iconOf(props.icon);

  const view = useMemo(() => {
    if (!data.response) return null;
    const rows = analyticsRows(data.response);
    const raw = rows[0]?.[valueKey] ?? null;
    const previousRaw = (data.response ? comparisonRows(data.response) : null)?.[0]?.[valueKey] ?? null;
    const current = asNumber(raw);
    const delta = wantsComparison && format !== 'text' && format !== 'date' && format !== 'month' ? deltaOf(current, comparisonRows(data.response) ? asNumber(previousRaw) : null) : null;
    let sub: string | null = null;
    if (subtitle?.mode === 'text') sub = localizedText(subtitle.text, locales);
    else if (subtitle?.mode === 'relative_date') sub = relativeDay(raw, locale);
    else if (subtitle?.mode === 'share' && total.response) {
      const whole = asNumber(analyticsRows(total.response)[0]?.[subtitle.totalKey]);
      const part = asNumber(rows[0]?.[subtitle.valueKey]);
      if (whole && part !== null) sub = `${formatValue((part / whole) * 100, 'percent', locale, 1)} ${localizedText(subtitle.label, locales) || t('kpi.ofTotal')}`;
    }
    return { raw, delta, sub, period: data.response.comparison?.previousPeriod ?? null };
  }, [data.response, format, locale, locales, subtitle, t, total.response, valueKey, wantsComparison]);

  const inverse = comparison?.inverse === true;
  const good = view?.delta ? (view.delta.direction === 'flat' ? null : (view.delta.direction === 'up') !== inverse) : null;
  const TrendIcon = view?.delta?.direction === 'up' ? ArrowUp : view?.delta?.direction === 'down' ? ArrowDown : Equals;
  const tooltip = localizedText(props.tooltip, locales);
  const compact = variant === 'compact';

  return (
    <div className="@container h-full min-w-0" title={tooltip || undefined} data-kpi-variant={variant}>
    <div className={cn('flex h-full min-w-0 items-center gap-2.5 @[190px]:gap-3', compact ? 'py-0.5' : 'py-1')}>
      <span className={cn('hidden shrink-0 items-center justify-center rounded-xl @[150px]:flex', compact ? 'size-9' : 'size-9 @[200px]:size-11')} style={{ background: tone.bg, color: tone.fg }} aria-hidden="true">
        <Glyph className={compact ? 'size-[18px]' : 'size-[18px] @[200px]:size-5'} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        {data.status === 'error' ? (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-error"><WarningCircle className="size-4 shrink-0" aria-hidden="true" />{t('analytics.error')}</p>
        ) : !view ? (
          <div className="space-y-1.5" aria-busy="true"><Skeleton className="h-6 w-24" /><Skeleton className="h-3 w-32" /></div>
        ) : (
          <div className={cn('min-w-0', data.refreshing && 'opacity-60 transition-opacity')} aria-busy={data.refreshing}>
            <p className="flex items-baseline gap-1.5">
              <span className={cn('truncate font-display font-semibold leading-tight tracking-tight text-text tabular-nums', compact ? 'text-lg' : 'text-[clamp(1.05rem,9cqw,1.45rem)]')}>{formatValue(view.raw, format, locale, decimals)}</span>
              {unit ? <span className="shrink-0 text-xs font-medium text-text-muted">{unit}</span> : null}
            </p>
            <p className="truncate text-[0.78rem] leading-snug text-text-secondary">{label}</p>
            {view.delta ? (
              <p className={cn('mt-0.5 flex items-center gap-1 text-[0.72rem] font-medium', good === null ? 'text-text-muted' : good ? 'text-success' : 'text-error')}>
                <TrendIcon className="size-3 shrink-0" weight="bold" aria-hidden="true" />
                <span className="tabular-nums">{view.delta.percent === null ? formatValue(view.delta.absolute, 'number', locale) : `${view.delta.percent > 0 ? '+' : ''}${formatValue(view.delta.percent, 'percent', locale, 1)}`}</span>
                <span className="truncate font-normal text-text-muted">{localizedText(comparison?.label, locales) || t('kpi.vsPrevious')}</span>
              </p>
            ) : view.sub ? <p className="mt-0.5 truncate text-[0.72rem] text-text-muted">{view.sub}</p> : null}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
