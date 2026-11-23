import { ArrowLeft, ClipboardText, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import type { AvailableRow } from './model';

type State = AvailableRow['state'];
const GROUPS: State[] = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

/** Facts that come from the evaluation's own data: sessions, questions, time rules, attempts, availability and last grade. */
function Facts({ row }: { row: AvailableRow }) {
  const { t } = useI18n();
  const items = [
    row.sectionCount > 1 ? t('st.exam.sessions', { n: row.sectionCount }) : null,
    t('ev.player.questions', { n: row.questionCount }),
    row.pacing.questionSeconds ? t('st.exam.perQuestion', { n: row.pacing.questionSeconds }) : null,
    row.pacing.sessionMinutes ? t('st.exam.perSession', { n: row.pacing.sessionMinutes }) : row.durationMinutes ? t('ev.player.minutes', { n: row.durationMinutes }) : t('ev.player.untimed'),
    row.maxAttempts ? t('ev.player.attempts', { used: row.attemptsUsed, max: row.maxAttempts }) : null,
  ].filter((item): item is string => Boolean(item));
  return (
    <>
      <p className="text-xs text-text-muted">{items.join(' · ')}</p>
      {row.opensAt && new Date(row.opensAt) > new Date() ? <p className="text-xs text-text-muted">{t('ev.player.opensAt', { date: new Date(row.opensAt).toLocaleString() })}</p> : null}
      {row.closesAt ? <p className="text-xs text-text-muted">{t('ev.player.closes', { date: new Date(row.closesAt).toLocaleString() })}</p> : null}
    </>
  );
}

function ExamCard({ row, onStart, onReview }: { row: AvailableRow; onStart: (row: AvailableRow) => void; onReview: (attemptId: string, title: string) => void }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0 space-y-1">
        <h4 className="font-display text-base font-semibold text-text [overflow-wrap:anywhere]">{row.title}</h4>
        {row.description ? <p className="line-clamp-3 text-sm text-text-secondary">{row.description}</p> : null}
        <Facts row={row} />
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">
          {row.lastPercent !== null ? <>{t('st.exam.lastGrade')} <strong className="tabular-nums text-text">{row.lastPercent} %</strong></> : row.state === 'IN_PROGRESS' ? <Status tone="pending">{t('ev.player.inProgress')}</Status> : !row.canStart ? <Status tone="neutral">{t('ev.player.unavailable')}</Status> : null}
        </span>
        <span className="flex flex-wrap gap-2">
          {row.state === 'COMPLETED' && row.lastAttemptId ? <Button variant={row.canStart ? 'ghost' : 'accent'} onClick={() => onReview(row.lastAttemptId!, row.title)}>{t('st.exam.review')}</Button> : null}
          {row.state !== 'COMPLETED' || row.canStart ? (
            <Button variant="accent" disabled={!row.canStart} onClick={() => onStart(row)}><Play className="size-4" aria-hidden />{row.state === 'IN_PROGRESS' ? t('st.exam.continue') : row.state === 'COMPLETED' ? t('st.exam.retry') : t('st.exam.start')}</Button>
          ) : null}
        </span>
      </div>
    </li>
  );
}

/** Inside a category: its evaluations grouped by their persisted state (to do, in progress, solved). Solved ones stay as history and open their review. */
export function CategoryView({ name, description, rows, onBack, onStart, onReview }: {
  name: string; description: string | null; rows: AvailableRow[]; onBack: () => void; onStart: (row: AvailableRow) => void; onReview: (attemptId: string, title: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section aria-label={name} className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" aria-hidden />{t('st.cat.back')}</Button>
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h2 className="font-display text-xl font-semibold text-text [overflow-wrap:anywhere]">{name}</h2>
          {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {rows.length === 0 ? <EmptyState icon={ClipboardText} title={t('st.cat.empty')} body={t('st.cat.emptyHint')} /> : GROUPS.map((state) => {
        const group = rows.filter((row) => row.state === state);
        return group.length === 0 ? null : (
          <section key={state} aria-label={t(`st.group.${state}`)} className="space-y-2">
            <h3 className="ui-label">{t(`st.group.${state}`)} <span className="tabular-nums text-text-muted">· {group.length}</span></h3>
            <ul className="grid gap-3 md:grid-cols-2">{group.map((row) => <ExamCard key={row.id} row={row} onStart={onStart} onReview={onReview} />)}</ul>
          </section>
        );
      })}
    </section>
  );
}
