import { useState } from 'react';
import { ArrowsClockwise, CheckCircle, MinusCircle, Timer, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Blocks } from './Blocks';
import { evaluationsApi } from './api';
import { formatClock, type CompetencyResult, type PerformanceLevel, type ResultView as Result, type ReviewItem } from './model';

const OUTCOME = {
  correct: { icon: CheckCircle, tone: 'text-success', key: 'ev.outcome.correct' },
  incorrect: { icon: XCircle, tone: 'text-error', key: 'ev.outcome.incorrect' },
  omitted: { icon: MinusCircle, tone: 'text-text-muted', key: 'ev.outcome.omitted' },
  invalid_timeout: { icon: Timer, tone: 'text-warning', key: 'ev.outcome.invalid_timeout' },
} as const;

/** Level colour by rank inside the evaluation's own table (lowest -> highest), so any number of levels reads the same way. */
function levelTone(levels: PerformanceLevel[], key: string) {
  const sorted = [...levels].sort((a, b) => a.minPercent - b.minPercent);
  const rank = Math.max(0, sorted.findIndex((level) => level.key === key));
  const ratio = sorted.length > 1 ? rank / (sorted.length - 1) : 1;
  return ratio < 0.25 ? { text: 'text-error', bar: 'bg-error', chip: 'bg-error/10 text-error' } : ratio < 0.6 ? { text: 'text-warning', bar: 'bg-warning', chip: 'bg-warning/10 text-warning' }
    : ratio < 1 ? { text: 'text-accent', bar: 'bg-accent', chip: 'bg-accent/10 text-accent' } : { text: 'text-success', bar: 'bg-success', chip: 'bg-success/10 text-success' };
}

const LevelChip = ({ levels, level }: { levels: PerformanceLevel[]; level: { key: string; label: string } }) => <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', levelTone(levels, level.key).chip)}>{level.label}</span>;

/**
 * Result of a closed attempt: summary KPIs, one card per competency with its level and personalised feedback paragraph, the improvement plan, the
 * sessions and, only when CORECROW released it, the question review. Result readers can also see (and regenerate) the feedback versions.
 */
export function ResultView({ result, title, onBack, organizationId, canRegenerate }: { result: Result; title?: string; onBack?: () => void; organizationId?: string; canRegenerate?: boolean }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(result);
  const [regenerating, setRegenerating] = useState<'idle' | 'busy' | 'same' | 'new' | 'error'>('idle');
  const { feedback, levels } = current;
  const regenerate = async () => {
    if (!organizationId) return;
    setRegenerating('busy');
    try { const outcome = await evaluationsApi.regenerateFeedback(organizationId, current.attemptId); setCurrent(await evaluationsApi.result(organizationId, current.attemptId)); setRegenerating(outcome.changed ? 'new' : 'same'); }
    catch { setRegenerating('error'); }
  };
  const kpi = (label: string, value: React.ReactNode) => <div className="rounded-xl border border-border bg-surface px-3 py-2.5"><dt className="text-xs text-text-muted">{label}</dt><dd className="font-display text-lg font-semibold tabular-nums text-text">{value}</dd></div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-3 sm:p-6">
      <header className="space-y-3">
        {title ? <h2 className="font-display text-lg font-semibold text-text [overflow-wrap:anywhere] sm:text-xl">{title}</h2> : null}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {kpi(t('st.result.grade'), <span className={levelTone(levels, feedback.overall.level.key).text}>{current.percent} %</span>)}
          {kpi(t('st.result.level'), <LevelChip levels={levels} level={feedback.overall.level} />)}
          {kpi(t('st.result.correct'), t('st.result.correctOf', { n: current.correct, total: current.correct + current.incorrect + current.unanswered + current.timedOut }))}
          {kpi(t('ev.result.time'), formatClock(current.timeUsedSeconds))}
          {kpi(t('st.result.finished'), current.submittedAt ? new Date(current.submittedAt).toLocaleDateString() : '—')}
        </dl>
        <p className="text-xs text-text-muted">{[t('st.result.counts', { incorrect: current.incorrect, omitted: current.unanswered, timedOut: current.timedOut }), current.status === 'EXPIRED' ? t('ev.result.expired') : null, t('st.result.levelsNote')].filter(Boolean).join(' · ')}</p>
      </header>

      <section aria-label={t('st.result.competencies')} className="space-y-3">
        <h3 className="ui-label">{t('st.result.competencies')}</h3>
        <ul className="grid gap-3 lg:grid-cols-3">{feedback.competencies.map((item) => <CompetencyCard key={item.key} item={item} levels={levels} />)}</ul>
      </section>

      {feedback.plan.length > 0 ? (
        <section aria-label={t('st.result.plan')} className="space-y-3">
          <h3 className="ui-label">{t('st.result.plan')}</h3>
          <ol className="space-y-2">{feedback.plan.map((item, index) => (
            <li key={item.skillId} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">{index + 1}</span>
              <div className="min-w-0 space-y-0.5 text-sm leading-6">
                <p className="font-medium text-text">{item.label} <span className="font-normal text-text-muted">· {item.priority === 'gap' ? t('st.result.planGap', { n: item.questions.join(', ') }) : t('st.result.planConsolidate')}</span></p>
                <p className="text-text-secondary">{t('st.result.study')}: {item.study}.</p>
                <p className="text-text-secondary">{t('st.result.strategy')}: {item.strategy}.</p>
              </div>
            </li>))}</ol>
        </section>) : null}

      {current.breakdown.bySection.length > 1 ? (
        <section aria-label={t('ev.result.bySection')} className="space-y-2">
          <h3 className="ui-label">{t('ev.result.bySection')}</h3>
          <ul className="grid gap-2 sm:grid-cols-3">{current.breakdown.bySection.map((group, index) => (
            <li key={group.key ?? index} className="rounded-xl border border-border bg-surface p-3 text-sm"><span className="block truncate text-text">{group.title ?? group.key}</span><span className="tabular-nums text-text-secondary">{group.correct}/{group.correct + group.incorrect + group.unanswered + group.timedOut} · {group.percent} %</span></li>))}</ul>
        </section>) : null}

      <section aria-label={t('ev.result.review')} className="space-y-3">
        <h3 className="ui-label">{t('ev.result.review')}</h3>
        {current.review.items ? <ol className="space-y-3">{current.review.items.map((item) => <ReviewCard key={item.questionId} item={item} />)}</ol>
          : <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">{current.review.policy === 'AFTER_DATE' && current.review.availableAt ? t('ev.result.reviewAfter', { date: new Date(current.review.availableAt).toLocaleString() }) : t('ev.result.reviewNever')}</p>}
      </section>

      {feedback.versions ? (
        <section aria-label={t('st.result.versions')} className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="ui-label">{t('st.result.versions')}</h3>
            {canRegenerate && organizationId ? <Button size="sm" variant="ghost" loading={regenerating === 'busy'} onClick={() => void regenerate()}><ArrowsClockwise className="size-4" aria-hidden />{t('st.result.regenerate')}</Button> : null}</div>
          <ul className="space-y-1 text-sm text-text-secondary">{feedback.versions.map((row) => <li key={row.version} className="tabular-nums">v{row.version} · {row.generator} · {t(row.reason === 'REGENERATED' ? 'st.result.reason.REGENERATED' : row.reason === 'BACKFILL' ? 'st.result.reason.BACKFILL' : 'st.result.reason.AUTO')} · {new Date(row.createdAt).toLocaleString()}</li>)}</ul>
          {regenerating === 'same' ? <p role="status" className="text-xs text-text-muted">{t('st.result.regenSame')}</p> : regenerating === 'new' ? <p role="status" className="text-xs text-success">{t('st.result.regenNew')}</p> : regenerating === 'error' ? <p role="alert" className="text-xs text-error">{t('st.result.regenError')}</p> : null}
        </section>) : null}

      {onBack ? <div className="flex justify-center"><Button variant="primary" onClick={onBack}>{t('ev.result.back')}</Button></div> : null}
    </div>
  );
}

function CompetencyCard({ item, levels }: { item: CompetencyResult; levels: PerformanceLevel[] }) {
  const { t } = useI18n();
  const tone = levelTone(levels, item.level.key);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2"><h4 className="font-display text-base font-semibold leading-tight text-text">{item.title}</h4><LevelChip levels={levels} level={item.level} /></div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm"><span className={cn('font-display text-2xl font-semibold tabular-nums', tone.text)}>{item.percent} %</span><span className="text-xs text-text-muted">{t('st.result.hits', { n: item.correct, total: item.total })}{item.timeSeconds !== null ? ` · ${formatClock(item.timeSeconds)}` : ''}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-label={item.title} aria-valuenow={item.percent} aria-valuemin={0} aria-valuemax={100}><div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
      </div>
      <p className="text-sm leading-6 text-text">{item.paragraph}</p>
      {item.masteredTopics.length || item.reinforceTopics.length ? (
        <dl className="space-y-1 text-xs text-text-secondary">
          {item.masteredTopics.length ? <div><dt className="inline font-medium text-success">{t('st.result.mastered')}: </dt><dd className="inline">{item.masteredTopics.join(' · ')}</dd></div> : null}
          {item.reinforceTopics.length ? <div><dt className="inline font-medium text-warning">{t('st.result.reinforce')}: </dt><dd className="inline">{item.reinforceTopics.join(' · ')}</dd></div> : null}
        </dl>) : null}
    </li>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const { t } = useI18n();
  const outcome = OUTCOME[item.outcome];
  const Glyph = outcome.icon;
  const meta = [item.competency, item.topic, item.seconds !== null ? formatClock(item.seconds) : null].filter(Boolean).join(' · ');
  return (
    <li className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h4 className="font-display text-sm font-semibold text-text">{t('ev.player.question', { n: item.number })}</h4>
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', outcome.tone)}><Glyph className="size-4" aria-hidden />{t(outcome.key)}</span>
        {meta ? <p className="basis-full text-xs text-text-muted">{meta}</p> : null}
      </div>
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
      {item.explanation.length ? <div className="rounded-lg bg-surface-hover/60 p-3"><p className="ui-label pb-1">{t('ev.result.explanation')}</p><Blocks blocks={item.explanation} className="text-sm leading-6" />{item.reference ? <p className="pt-2 text-xs text-text-muted">{t('st.result.reference')}: {item.reference}</p> : null}</div> : null}
    </li>
  );
}
