import { useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/features/admin-center/hooks';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { statsApi } from './api';
import { barHeights, formatClock, formatPoints, type QuestionStat } from './model';
import { ChartBar } from '@phosphor-icons/react';

const field = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
const pct = (value: number | null) => (value === null ? '—' : `${value}%`);

/** Statistics of one evaluation version: completion, score distribution, hardest questions with distractors, categories, version comparison. */
export function StatsView({ organizationId, evaluationId }: { organizationId: string; evaluationId: string }) {
  const { t } = useI18n();
  const [versionId, setVersionId] = useState('');
  const data = useResource(() => statsApi.stats(organizationId, evaluationId, versionId || undefined), [organizationId, evaluationId, versionId]);
  if (data.status === 'loading' && !data.data) return <Skeleton className="h-40 w-full rounded-xl" />;
  const response = data.data;
  if (!response || !response.stats) return <EmptyState icon={ChartBar} title={t('ev.stats.none')} body={t('ev.stats.noneHint')} />;
  const { stats } = response;
  const selected = response.selectedVersionId ?? '';
  const card = (label: string, value: string, hint?: string) => <div className="rounded-xl border border-border bg-surface p-3"><dt className="text-xs text-text-muted">{label}</dt><dd className="font-display text-xl font-semibold tabular-nums text-text">{value}</dd>{hint ? <dd className="text-[11px] text-text-muted">{hint}</dd> : null}</div>;
  const heights = barHeights(stats.score.distribution.map((bucket) => bucket.count));
  const hardest = stats.hardest.map((id) => stats.questions.find((q) => q.questionId === id)).filter((q): q is QuestionStat => Boolean(q));

  return (
    <div className="space-y-6">
      {response.versions.length > 1 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm"><span className="ui-label">{t('ev.stats.version')}</span>
          <select className={field} value={selected} onChange={(event) => setVersionId(event.target.value)}>{response.versions.map((v) => <option key={v.id} value={v.id}>{t('ev.stats.versionOption', { n: v.version, attempts: v.attempts })}</option>)}</select></label>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {card(t('ev.stats.started'), String(stats.attempts.started), t('ev.stats.graded', { n: stats.attempts.graded }))}
        {card(t('ev.stats.completion'), pct(stats.attempts.completionRate), t('ev.stats.timedOut', { n: pct(stats.attempts.timedOutRate) }))}
        {card(t('ev.stats.mean'), pct(stats.score.meanPercent))}
        {card(t('ev.stats.median'), pct(stats.score.medianPercent))}
        {card(t('ev.stats.range'), stats.score.minPercent === null ? '—' : `${stats.score.minPercent}–${stats.score.maxPercent}%`)}
        {card(t('ev.stats.time'), stats.averageTimeSeconds === null ? '—' : formatClock(stats.averageTimeSeconds))}
      </dl>

      <section aria-label={t('ev.stats.distribution')} className="space-y-2">
        <h3 className="ui-label">{t('ev.stats.distribution')}</h3>
        <ul className="flex h-36 items-end gap-1.5 rounded-xl border border-border bg-surface p-3 sm:gap-2">
          {stats.score.distribution.map((bucket, index) => (
            <li key={bucket.from} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={t('ev.stats.bucket', { from: bucket.from, to: bucket.to, n: bucket.count })}>
              <span className="text-[10px] tabular-nums text-text-muted">{bucket.count || ''}</span>
              <span className="w-full rounded-t bg-accent/80" style={{ height: `${heights[index]}%` }} />
              <span className="text-[10px] tabular-nums text-text-muted">{bucket.from}</span>
            </li>))}
        </ul>
      </section>

      <section aria-label={t('ev.stats.hardest')} className="space-y-2">
        <h3 className="ui-label">{t('ev.stats.hardest')}</h3>
        <p className="text-xs text-text-muted">{t('ev.stats.hardestHint')}</p>
        <ul className="space-y-2">
          {hardest.map((q) => (
            <li key={q.questionId} className="rounded-xl border border-border bg-surface">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                  <span className="font-display text-sm font-semibold text-text">{t('ev.player.question', { n: q.number })}</span>
                  <span className="min-w-0 flex-1 basis-40 truncate text-sm text-text-secondary">{q.prompt}</span>
                  <span className="shrink-0 text-sm tabular-nums text-text">{pct(q.correctRate)}</span>
                  <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-surface-hover" aria-hidden><span className="block h-full rounded-full bg-accent" style={{ width: `${q.correctRate ?? 0}%` }} /></span>
                </summary>
                <div className="space-y-2 border-t border-border p-3">
                  <p className="text-xs text-text-muted">{t('ev.stats.questionMeta', { correct: q.correct, incorrect: q.incorrect, omitted: q.omitted, timedOut: q.timedOut })}{q.category ? ` · ${q.category}` : ''}</p>
                  <ul className="space-y-1.5">{q.options.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 text-sm">
                      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', o.isCorrect ? 'border-success bg-success/15 text-success' : 'border-border-strong')}>{o.label}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover" aria-hidden><span className={cn('block h-full rounded-full', o.isCorrect ? 'bg-success' : 'bg-text-muted')} style={{ width: `${q.attempts ? (o.picked * 100) / q.attempts : 0}%` }} /></span>
                      <span className="w-16 shrink-0 text-right tabular-nums text-text-secondary">{t('ev.stats.picked', { n: o.picked })}</span>
                    </li>))}</ul>
                </div>
              </details>
            </li>))}
        </ul>
      </section>

      {stats.categories.length > 1 || (stats.categories[0] && stats.categories[0].category !== null) ? (
        <section aria-label={t('ev.result.byCategory')} className="space-y-2">
          <h3 className="ui-label">{t('ev.result.byCategory')}</h3>
          <ul className="space-y-2">{stats.categories.map((c, i) => (
            <li key={c.category ?? `none-${i}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate text-text">{c.category ?? t('ev.result.uncategorized')}</span><span className="shrink-0 tabular-nums text-text-secondary">{c.meanPercent}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, c.meanPercent)}%` }} /></div>
            </li>))}</ul>
        </section>) : null}

      {response.versions.length > 1 ? (
        <section aria-label={t('ev.stats.compare')} className="space-y-2">
          <h3 className="ui-label">{t('ev.stats.compare')}</h3>
          <div className="max-w-full overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead><tr className="bg-surface-hover text-xs text-text-muted"><th className="px-3 py-2 font-medium">{t('ev.stats.version')}</th><th className="px-3 py-2 font-medium">{t('ev.stats.published')}</th><th className="px-3 py-2 text-right font-medium">{t('ev.stats.questions')}</th><th className="px-3 py-2 text-right font-medium">{t('ev.stats.started')}</th><th className="px-3 py-2 text-right font-medium">{t('ev.stats.mean')}</th></tr></thead>
              <tbody>{response.versions.map((v) => (
                <tr key={v.id} className={cn('border-t border-border', v.id === selected && 'bg-accent/5')}>
                  <td className="px-3 py-2 font-medium">v{v.version}</td><td className="px-3 py-2 text-text-secondary">{new Date(v.publishedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.questionCount} · {formatPoints(v.maxPoints)} pt</td><td className="px-3 py-2 text-right tabular-nums">{v.attempts}</td><td className="px-3 py-2 text-right tabular-nums">{pct(v.meanPercent)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>) : null}
    </div>
  );
}
