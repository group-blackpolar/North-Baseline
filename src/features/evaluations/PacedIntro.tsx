import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import type { AvailableRow } from './model';

/** Before a paced attempt: what it is, how it is timed and the validity rules, with an explicit start. Everything shown comes from the evaluation's data. */
export function PacedIntro({ row, onStart, onCancel }: { row: AvailableRow | null; onStart: (row: AvailableRow) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const seconds = row?.pacing.questionSeconds ?? null;
  const facts = row ? [
    t('ev.intro.sessions', { n: row.sectionCount }),
    t('ev.intro.questions', { n: row.questionCount }),
    row.durationMinutes ? t('ev.intro.total', { n: row.durationMinutes }) : null,
    seconds ? t('ev.intro.perQuestion', { n: seconds }) : null,
  ].filter((fact): fact is string => Boolean(fact)) : [];
  return (
    <Dialog open={row !== null} onOpenChange={(open) => { if (!open) onCancel(); }} title={row?.title ?? ''} size="md"
      footer={<><Button variant="ghost" onClick={onCancel}>{t('access.cancel')}</Button><Button variant="accent" onClick={() => row && onStart(row)}>{t('ev.intro.start')}</Button></>}>
      {row ? (
        <div className="space-y-4">
          {row.description ? <p className="whitespace-pre-line text-sm leading-6 text-text-secondary">{row.description}</p> : null}
          <ul className="grid grid-cols-2 gap-2">{facts.map((fact) => <li key={fact} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text">{fact}</li>)}</ul>
          <div className="space-y-1.5">
            <h3 className="ui-label">{t('ev.intro.rules')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-text">
              <li>{t('ev.intro.ruleOrder')}</li>
              <li>{t('ev.intro.ruleConfirm')}</li>
              {seconds ? <li>{t('ev.intro.ruleTimeout', { n: seconds })}</li> : null}
              <li>{t('ev.intro.ruleNoBack')}</li>
              <li className="font-medium">{t('ev.intro.ruleClock')}</li>
            </ul>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
