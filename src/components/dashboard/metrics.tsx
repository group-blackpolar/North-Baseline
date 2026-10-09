import type { ComponentType, ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Warning, WarningOctagon, CheckCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * Presentational dashboard metrics. They are data-agnostic (they receive already-formatted values from a binding result)
 * and organization-agnostic: no component here knows a dataset, a tenant or a business domain. Null/undefined values
 * render as an em dash, never as "0" or "NaN".
 */

const dash = '—';
type IconType = ComponentType<{ className?: string }>;
export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-text-secondary', positive: 'text-success', negative: 'text-error', warning: 'text-warning', info: 'text-accent',
};

/** Percentage change between two numbers; null when it is undefined (no baseline) instead of Infinity/NaN. */
export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDelta(change: number | null, locale?: string): string {
  if (change === null) return dash;
  const sign = change > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(change)}%`;
}

/** KPI with a trend: the arrow direction follows the sign; `goodWhen` decides whether up is positive (default) or negative (e.g. cost). */
export function TrendCard({ label, value, change, caption, icon: Icon, goodWhen = 'up', locale, loading, className }: {
  label: string; value: string | null | undefined; change?: number | null; caption?: string; icon?: IconType; goodWhen?: 'up' | 'down'; locale?: string; loading?: boolean; className?: string;
}) {
  const direction = change == null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
  const tone: Tone = direction === 'flat' ? 'neutral' : direction === goodWhen ? 'positive' : 'negative';
  const Arrow = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight;
  return (
    <div className={cn('np-card flex items-start justify-between gap-3 p-4', className)} aria-busy={loading || undefined}>
      <div className="min-w-0">
        <p className="ui-label pb-1">{label}</p>
        <p className="truncate font-display text-2xl font-semibold tabular-nums text-text">{loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-surface-active" /> : (value ?? dash)}</p>
        {change !== undefined ? (
          <p className={cn('mt-1 flex items-center gap-1 text-xs', TONE_TEXT[tone])}>
            <Arrow className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{formatDelta(change ?? null, locale)}</span>
            {caption ? <span className="truncate text-text-muted">{caption}</span> : null}
          </p>
        ) : null}
      </div>
      {Icon ? <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-active"><Icon className="size-4 text-text-secondary" /></div> : null}
    </div>
  );
}

/** Two values side by side (e.g. this period vs. the previous one) with the relative difference. */
export function ComparisonCard({ label, current, previous, currentLabel, previousLabel, change, locale, className }: {
  label: string; current: string | null | undefined; previous: string | null | undefined; currentLabel: string; previousLabel: string; change?: number | null; locale?: string; className?: string;
}) {
  return (
    <div className={cn('np-card space-y-3 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="ui-label">{label}</p>
        {change !== undefined ? <span className={cn('text-xs font-medium tabular-nums', change == null || change === 0 ? TONE_TEXT.neutral : change > 0 ? TONE_TEXT.positive : TONE_TEXT.negative)}>{formatDelta(change ?? null, locale)}</span> : null}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0"><dt className="text-[11px] text-text-muted">{currentLabel}</dt><dd className="truncate font-display text-xl font-semibold tabular-nums">{current ?? dash}</dd></div>
        <div className="min-w-0"><dt className="text-[11px] text-text-muted">{previousLabel}</dt><dd className="truncate font-display text-xl font-semibold tabular-nums text-text-secondary">{previous ?? dash}</dd></div>
      </dl>
    </div>
  );
}

/** Progress toward a target. `value`/`target` are numbers; the bar is clamped to 0–100 % but the label keeps the true ratio. */
export function ProgressIndicator({ label, value, target, formatValue = String, className }: {
  label: string; value: number | null | undefined; target: number | null | undefined; formatValue?: (value: number) => string; className?: string;
}) {
  const ratio = value != null && target ? value / target : null;
  const pct = ratio === null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className={cn('np-card space-y-2 p-4', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="ui-label">{label}</p>
        <p className="text-xs tabular-nums text-text-secondary">{value != null ? formatValue(value) : dash}{target != null ? ` / ${formatValue(target)}` : ''}</p>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : Math.round(pct)} className="h-2 overflow-hidden rounded-full bg-surface-active">
        <div className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) motion-reduce:transition-none" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="text-right text-[11px] tabular-nums text-text-muted">{ratio === null || !Number.isFinite(ratio) ? dash : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(ratio * 100)}%`}</p>
    </div>
  );
}

const PANEL_ICON: Record<Exclude<Tone, 'neutral'>, IconType> = { positive: CheckCircle, negative: WarningOctagon, warning: Warning, info: Info };
const PANEL_STYLE: Record<Tone, string> = {
  neutral: 'border-border bg-surface', positive: 'border-success/40 bg-success/5', negative: 'border-error/40 bg-error/5', warning: 'border-warning/40 bg-warning/5', info: 'border-accent/40 bg-accent-soft',
};

/** Information / status / alert / note panel. Alerts (`negative`, `warning`) are announced to assistive technology. */
export function StatusPanel({ tone = 'neutral', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const Icon = tone === 'neutral' ? null : PANEL_ICON[tone];
  return (
    <div role={tone === 'negative' || tone === 'warning' ? 'alert' : 'note'} className={cn('flex items-start gap-3 rounded-xl border p-4', PANEL_STYLE[tone], className)}>
      {Icon ? <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_TEXT[tone])} aria-hidden="true" /> : null}
      <div className="min-w-0 space-y-1">
        {title ? <p className="text-sm font-medium text-text">{title}</p> : null}
        {children ? <div className="text-xs leading-relaxed text-text-secondary">{children}</div> : null}
      </div>
    </div>
  );
}
