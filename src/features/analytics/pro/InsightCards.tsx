import { Lightbulb } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { analyticsRows, bindingIdOf, comparisonRows, useBindingResult } from './bindingSource';
import { asNumber, deltaOf, formatValue, localizedText, TONE_VARS, toneOf } from './format';
import { iconOf } from './icons';

type Props = Record<string, unknown>;
type Rule = { id: string; rule: 'leader_share' | 'period_change' | 'top_concentration'; binding: string; labelKey?: string; valueKey: string; top?: number; title: unknown; tone?: string; icon?: string };

const parseRules = (value: unknown): Rule[] => (Array.isArray(value) ? value.filter((item): item is Rule => Boolean(item) && typeof item === 'object' && typeof (item as Rule).id === 'string' && typeof (item as Rule).binding === 'string' && typeof (item as Rule).valueKey === 'string') : []);

/**
 * Deterministic insights: every figure is computed from a binding result CORECROW returned. A ranking insight needs the
 * complete ranking (all groups) to state a share, otherwise it is withheld rather than guessed.
 */
export function InsightCards({ props, bindings, locales }: { props: Props; bindings: Record<string, unknown>; locales: string[] }) {
  const title = localizedText(props.title, locales);
  const rules = parseRules(props.items);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {title ? <h3 className="mb-2 flex items-center gap-1.5 font-display text-[0.95rem] font-semibold text-text"><Lightbulb className="size-4 text-warning" weight="fill" aria-hidden="true" />{title}</h3> : null}
      <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {rules.map((rule) => <li key={rule.id} className="min-w-0"><InsightCard rule={rule} bindingId={bindingIdOf(bindings, rule.binding)} locales={locales} /></li>)}
      </ul>
    </div>
  );
}

function InsightCard({ rule, bindingId, locales }: { rule: Rule; bindingId: string | null; locales: string[] }) {
  const { t, locale } = useI18n();
  const result = useBindingResult(bindingId, rule.rule === 'period_change' ? { compare: true } : {});
  const tone = TONE_VARS[toneOf(rule.tone, rule.rule === 'period_change' ? 'green' : 'blue')];
  const Glyph = iconOf(rule.icon);
  const label = localizedText(rule.title, locales);

  const body = useMemo(() => {
    if (!result.response) return null;
    const rows = analyticsRows(result.response);
    const complete = result.response.totalRows === undefined || result.response.totalRows <= rows.length;
    if (rule.rule === 'period_change') {
      const previous = comparisonRows(result.response);
      if (!previous) return { headline: '—', text: t('insight.needsPeriod') };
      const delta = deltaOf(asNumber(rows[0]?.[rule.valueKey]), asNumber(previous[0]?.[rule.valueKey]));
      if (!delta) return { headline: '—', text: t('insight.noComparable') };
      const headline = delta.percent === null ? formatValue(delta.absolute, 'number', locale) : `${delta.percent > 0 ? '+' : ''}${formatValue(delta.percent, 'percent', locale, 1)}`;
      return { headline, text: t('insight.periodChange', { from: result.response.comparison?.previousPeriod.from ?? '', to: result.response.comparison?.period.from ?? '' }) };
    }
    if (!rule.labelKey) return null;
    const ranking = rows.map((row) => ({ name: row[rule.labelKey!], value: asNumber(row[rule.valueKey]) })).filter((item): item is { name: string; value: number } => typeof item.name === 'string' && item.value !== null).sort((a, b) => b.value - a.value);
    if (!ranking.length) return null;
    if (!complete) return { headline: '—', text: t('insight.incomplete') };
    const whole = ranking.reduce((sum, item) => sum + item.value, 0);
    if (!whole) return null;
    if (rule.rule === 'leader_share') return { headline: ranking[0]!.name, text: t('insight.leader', { share: formatValue((ranking[0]!.value / whole) * 100, 'percent', locale, 1) }) };
    const top = Math.max(1, rule.top ?? 3);
    const part = ranking.slice(0, top).reduce((sum, item) => sum + item.value, 0);
    return { headline: formatValue((part / whole) * 100, 'percent', locale, 1), text: t('insight.concentration', { n: Math.min(top, ranking.length) }) };
  }, [locale, result.response, rule, t]);

  return (
    <div className="flex h-full min-w-0 items-start gap-2.5 rounded-xl border border-border bg-surface p-2.5 shadow-xs transition-shadow hover:shadow-soft">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: tone.bg, color: tone.fg }} aria-hidden="true"><Glyph className="size-[18px]" weight="fill" /></span>
      <div className="min-w-0 flex-1">
        {result.status === 'error' ? <p role="alert" className="text-xs text-error">{t('analytics.error')}</p> : !result.response ? <div className="space-y-1.5" aria-busy="true"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-32" /></div> : body ? (
          <>
            <p className="truncate text-[0.92rem] font-semibold leading-tight text-text" title={body.headline}>{body.headline}</p>
            <p className="truncate text-[0.72rem] font-medium text-text-secondary" title={label}>{label}</p>
            <p className="mt-0.5 text-[0.7rem] leading-snug text-text-muted">{body.text}</p>
          </>
        ) : <p className="text-xs text-text-muted">{t('analytics.empty')}</p>}
      </div>
    </div>
  );
}
