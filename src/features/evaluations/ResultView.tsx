import { CheckCircle, MinusCircle, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Blocks } from './Blocks';
import { formatClock, formatPoints, type Group, type ResultView as Result, type ReviewItem } from './model';

const OUTCOME = {
  correct: { icon: CheckCircle, tone: 'text-success', key: 'ev.result.correct' },
  incorrect: { icon: XCircle, tone: 'text-error', key: 'ev.result.incorrect' },
  unanswered: { icon: MinusCircle, tone: 'text-text-muted', key: 'ev.result.unanswered' },
} as const;

/** Score, counts, time, per-category / per-section breakdown and, only when CORECROW released it, the review with correct answers. */
export function ResultView({ result, title, onBack }: { result: Result; title?: string; onBack?: () => void }) {
  const { t } = useI18n();
  const stat = (label: string, value: string) => <div className="rounded-xl border border-border bg-surface p-3"><dt className="text-xs text-text-muted">{label}</dt><dd className="font-display text-xl font-semibold tabular-nums text-text">{value}</dd></div>;
  const bars = (groups: Group[], heading: string) => groups.length ? (
    <section aria-label={heading} className="space-y-2">
      <h3 className="ui-label">{heading}</h3>
      <ul className="space-y-2">
        {groups.map((group, index) => (
          <li key={group.key ?? `none-${index}`} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate text-text">{group.title ?? group.key ?? t('ev.result.uncategorized')}</span><span className="shrink-0 tabular-nums text-text-secondary">{formatPoints(group.scorePoints)}/{formatPoints(group.maxPoints)} · {group.percent}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-valuenow={group.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, group.percent)}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1 text-center">
        {title ? <p className="ui-label">{title}</p> : null}
        <p className="font-display text-5xl font-semibold tabular-nums text-text">{result.percent}%</p>
        <p className="text-sm text-text-secondary">{t('ev.result.score', { score: formatPoints(result.scorePoints), max: formatPoints(result.maxPoints) })}</p>
        {result.status === 'EXPIRED' ? <p className="text-xs text-warning">{t('ev.result.expired')}</p> : null}
      </header>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(t('ev.result.correct'), String(result.correct))}
        {stat(t('ev.result.incorrect'), String(result.incorrect))}
        {stat(t('ev.result.unanswered'), String(result.unanswered))}
        {stat(t('ev.result.time'), formatClock(result.timeUsedSeconds))}
      </dl>
      {bars(result.breakdown.byCategory, t('ev.result.byCategory'))}
      {result.breakdown.bySection.length > 1 ? bars(result.breakdown.bySection, t('ev.result.bySection')) : null}

      <section aria-label={t('ev.result.review')} className="space-y-3">
        <h3 className="ui-label">{t('ev.result.review')}</h3>
        {result.review.items ? <ol className="space-y-4">{result.review.items.map((item) => <ReviewCard key={item.questionId} item={item} />)}</ol>
          : <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">{result.review.policy === 'AFTER_DATE' && result.review.availableAt ? t('ev.result.reviewAfter', { date: new Date(result.review.availableAt).toLocaleString() }) : t('ev.result.reviewNever')}</p>}
      </section>
      {onBack ? <div className="flex justify-center"><Button variant="primary" onClick={onBack}>{t('ev.result.back')}</Button></div> : null}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const { t } = useI18n();
  const outcome = OUTCOME[item.outcome];
  const Glyph = outcome.icon;
  return (
    <li className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2"><h4 className="font-display text-sm font-semibold text-text">{t('ev.player.question', { n: item.number })}</h4><span className={cn('inline-flex items-center gap-1 text-xs font-medium', outcome.tone)}><Glyph className="size-4" aria-hidden />{t(outcome.key)}</span></div>
      <Blocks blocks={item.prompt} />
      <ul className="space-y-1.5">
        {item.options.map((option) => {
          const mine = option.id === item.selectedOptionId, right = option.id === item.correctOptionId;
          return (
            <li key={option.id} className={cn('flex items-start gap-2 rounded-lg border p-2.5 text-sm', right ? 'border-success/50 bg-success/10' : mine ? 'border-error/50 bg-error/10' : 'border-border')}>
              <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-semibold">{option.label}</span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{option.text}</span>
              {right ? <span className="shrink-0 text-xs font-medium text-success">{t('ev.result.theCorrectOne')}</span> : mine ? <span className="shrink-0 text-xs font-medium text-error">{t('ev.result.yourAnswer')}</span> : null}
            </li>
          );
        })}
      </ul>
      {item.explanation.length ? <div className="rounded-lg bg-surface-hover/60 p-3"><p className="ui-label pb-1">{t('ev.result.explanation')}</p><Blocks blocks={item.explanation} className="text-sm leading-6" /></div> : null}
    </li>
  );
}
