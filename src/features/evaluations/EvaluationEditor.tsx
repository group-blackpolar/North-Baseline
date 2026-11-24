import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, CloudArrowUp, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useResource } from '@/features/admin-center/hooks';
import { ApiError } from '@/lib/api';
import { EVALUATIONS_CHANGED_EVENT, useAssistantPage } from '@/features/assistant/AssistantContext';
import { useI18n } from '@/lib/i18n';
import { listPermissionSubjects } from '@/lib/northAdmin';
import { cn } from '@/lib/utils';
import { evaluationsApi } from './api';
import { CategoryPicker, LevelsEditor, SkillsEditor } from './AuthoringExtras';
import { ContentEditor } from './ContentEditor';
import { formatPoints, type AssignmentRow, type Issue, type Settings } from './model';
import { useDraft } from './useDraft';

const field = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60';
const ISSUES = new Set(['EVALUATION_NO_QUESTIONS', 'EVALUATION_PROMPT_EMPTY', 'EVALUATION_OPTIONS_MIN', 'EVALUATION_OPTION_EMPTY', 'EVALUATION_CORRECT_OPTION_MISSING', 'EVALUATION_CORRECT_OPTION_INVALID', 'EVALUATION_POINTS_INVALID', 'EVALUATION_SECTION_UNKNOWN', 'EVALUATION_PASSAGE_UNKNOWN', 'EVALUATION_PASSAGE_EMPTY', 'EVALUATION_SECTION_TITLE_EMPTY', 'EVALUATION_DUPLICATE_ID', 'EVALUATION_REVIEW_DATE_REQUIRED', 'EVALUATION_SECTION_ORDER', 'EVALUATION_AI_REVIEW_PENDING']);
type Tab = 'content' | 'settings' | 'assignments' | 'publish';
const TABS: Tab[] = ['content', 'settings', 'assignments', 'publish'];
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

/** One evaluation's editor: content, settings (duration, attempts, scoring, review policy), assignments, validation and publication. */
export function EvaluationEditor({ organizationId, evaluationId, can, onBack }: { organizationId: string; evaluationId: string; can: { update: boolean; publish: boolean; manage: boolean }; onBack: () => void }) {
  const { t } = useI18n();
  const draft = useDraft(organizationId, evaluationId, { conflict: t('ev.builder.conflict') });
  const [tab, setTab] = useState<Tab>('content');
  const view = draft.view;
  // The assistant may be told which evaluation this is (identifiers only, and only if the person chooses to share the page).
  useAssistantPage({ module: 'evaluations', label: view?.title ?? undefined, resource: { type: 'evaluation', id: evaluationId } });
  // A confirmed assistant action changes the draft on the server: reload it (pending local edits are sent first).
  const { commitAll, reload } = draft;
  useEffect(() => {
    const refresh = () => { void commitAll().then(() => reload()); };
    window.addEventListener(EVALUATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EVALUATIONS_CHANGED_EVENT, refresh);
  }, [commitAll, reload]);
  if (draft.loadError) return <p role="alert" className="p-4 text-sm text-error">{draft.loadError}</p>;
  if (!view) return <Skeleton className="h-64 w-full rounded-xl" />;
  const archived = view.status === 'ARCHIVED';
  const locked = !can.update || archived;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" aria-hidden />{t('ev.builder.back')}</Button>
        <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-text">{view.title}</h2>
        <Status tone={view.status === 'PUBLISHED' ? 'active' : view.status === 'ARCHIVED' ? 'neutral' : 'pending'}>{t(`ev.status.${view.status}`)}</Status>
        {view.hasUnpublishedChanges ? <Status tone="info">{t('ev.builder.unpublished')}</Status> : null}
        <span role="status" className="inline-flex items-center gap-1 text-xs text-text-muted">
          {draft.state === 'saving' ? <><span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />{t('ev.builder.saving')}</> : draft.state === 'error' ? <><WarningCircle className="size-4 text-error" aria-hidden />{t('ev.builder.saveError')}</> : <><CheckCircle className="size-4" aria-hidden />{t('ev.builder.saved')}</>}
        </span>
      </header>
      {draft.error ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{draft.error}</p> : null}
      {archived ? <p className="rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">{t('ev.builder.archivedNote')}</p> : null}

      <div role="tablist" aria-label={t('ev.builder.sections')} className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((id) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('shrink-0 border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent/40', tab === id ? 'border-accent text-text' : 'border-transparent text-text-secondary hover:text-text')}>{t(`ev.tab.${id}`)}</button>)}
      </div>

      {tab === 'content' ? <ContentEditor organizationId={organizationId} evaluationId={evaluationId} draft={draft} locked={locked} /> : null}
      {tab === 'settings' ? <SettingsTab organizationId={organizationId} evaluationId={evaluationId} draft={draft} locked={locked} /> : null}
      {tab === 'assignments' ? <AssignmentsTab organizationId={organizationId} evaluationId={evaluationId} editable={can.manage && !archived} /> : null}
      {tab === 'publish' ? <PublishTab organizationId={organizationId} evaluationId={evaluationId} draft={draft} canPublish={can.publish && !archived} /> : null}
    </div>
  );
}

function SettingsTab({ organizationId, evaluationId, draft, locked }: { organizationId: string; evaluationId: string; draft: ReturnType<typeof useDraft>; locked: boolean }) {
  const { t } = useI18n();
  const view = draft.view!;
  const [title, setTitle] = useState(view.title);
  const [description, setDescription] = useState(view.description ?? '');
  const [settings, setSettings] = useState<Settings>(view.content.settings);
  const [skills, setSkills] = useState(view.content.skills);
  const [categoryId, setCategoryId] = useState(view.categoryId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const patch = (next: Partial<Settings>) => setSettings((current) => ({ ...current, ...next }));
  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      await draft.commitAll();
      const saved = await evaluationsApi.updateDetails(organizationId, evaluationId, { title: title.trim() || view.title, description: description.trim() || null, settings, skills, expectedRevision: draft.revision.current });
      draft.revision.current = saved.draftRevision; draft.setView(saved); setMessage({ ok: true, text: t('ev.settings.saved') });
    } catch (reason) { setMessage({ ok: false, text: reason instanceof ApiError && reason.code === 'EVALUATION_REVISION_CONFLICT' ? t('ev.builder.conflict') : reason instanceof Error ? reason.message : 'error' }); if (reason instanceof ApiError && reason.code === 'EVALUATION_REVISION_CONFLICT') await draft.reload(); }
    finally { setBusy(false); }
  };
  const num = (value: string, fallback: number | null) => { const n = Number(value); return value === '' || !Number.isFinite(n) ? fallback : n; };

  return (
    <div className="max-w-2xl space-y-5">
      <label className="block space-y-1"><span className="ui-label">{t('ev.settings.title')}</span><input className={field} value={title} maxLength={200} disabled={locked} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="block space-y-1"><span className="ui-label">{t('ev.settings.description')}</span><textarea className={cn(field, 'min-h-20 resize-y')} value={description} maxLength={2000} disabled={locked} onChange={(event) => setDescription(event.target.value)} /></label>
      <CategoryPicker organizationId={organizationId} evaluationId={evaluationId} value={categoryId} disabled={locked} onChanged={setCategoryId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1"><span className="ui-label">{t('ev.settings.duration')}</span>
          <input type="number" min={1} max={1440} inputMode="numeric" className={field} placeholder={t('ev.settings.untimed')} value={settings.durationMinutes ?? ''} disabled={locked} onChange={(event) => patch({ durationMinutes: num(event.target.value, null) })} />
          <span className="text-xs text-text-muted">{t('ev.settings.durationHint')}</span></label>
        <label className="space-y-1"><span className="ui-label">{t('ev.settings.attempts')}</span>
          <input type="number" min={1} max={100} inputMode="numeric" className={field} placeholder={t('ev.settings.unlimited')} value={settings.maxAttempts ?? ''} disabled={locked} onChange={(event) => patch({ maxAttempts: num(event.target.value, null) })} />
          <span className="text-xs text-text-muted">{t('ev.settings.attemptsHint')}</span></label>
      </div>
      <fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="ui-label px-1">{t('ev.settings.pacing')}</legend>
        <select aria-label={t('ev.settings.pacing')} className={field} value={settings.pacing.navigation} disabled={locked} onChange={(event) => patch({ pacing: { ...settings.pacing, navigation: event.target.value as Settings['pacing']['navigation'] } })}>
          {(['FREE', 'FORWARD_ONLY'] as const).map((mode) => <option key={mode} value={mode}>{t(`ev.settings.pacing.${mode}`)}</option>)}
        </select>
        {settings.pacing.navigation === 'FORWARD_ONLY' ? (
          <>
          <label className="block space-y-1"><span className="text-sm text-text">{t('ev.settings.questionSeconds')}</span>
            <input type="number" min={5} max={3600} inputMode="numeric" className={field} placeholder={t('ev.settings.unlimited')} value={settings.pacing.questionSeconds ?? ''} disabled={locked} onChange={(event) => patch({ pacing: { ...settings.pacing, questionSeconds: num(event.target.value, null) } })} />
            <span className="text-xs text-text-muted">{t('ev.settings.questionSecondsHint')}</span></label>
            <label className="block space-y-1"><span className="text-sm text-text">{t('st.builder.sessionMinutes')}</span>
              <input type="number" min={1} max={1440} inputMode="numeric" className={field} placeholder={t('ev.settings.unlimited')} value={settings.pacing.sessionMinutes ?? ''} disabled={locked} onChange={(event) => patch({ pacing: { ...settings.pacing, sessionMinutes: num(event.target.value, null) } })} />
              <span className="text-xs text-text-muted">{t('st.builder.sessionMinutesHint')}</span></label>
          </>
        ) : null}
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="ui-label px-1">{t('ev.settings.scoring')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-sm text-text">{t('ev.settings.wrong')}</span><input type="number" min={0} max={100} className={field} value={settings.scoring.wrongPenaltyPercent} disabled={locked} onChange={(event) => patch({ scoring: { ...settings.scoring, wrongPenaltyPercent: num(event.target.value, 0) ?? 0 } })} /></label>
          <label className="space-y-1"><span className="text-sm text-text">{t('ev.settings.blank')}</span><input type="number" min={0} max={100} className={field} value={settings.scoring.unansweredPenaltyPercent} disabled={locked} onChange={(event) => patch({ scoring: { ...settings.scoring, unansweredPenaltyPercent: num(event.target.value, 0) ?? 0 } })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.scoring.floorAtZero} disabled={locked} onChange={(event) => patch({ scoring: { ...settings.scoring, floorAtZero: event.target.checked } })} />{t('ev.settings.floor')}</label>
        <p className="text-xs text-text-muted">{t('ev.settings.scoringHint')}</p>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-border p-3"><legend className="ui-label px-1">{t('ev.settings.review')}</legend>
        <select aria-label={t('ev.settings.review')} className={field} value={settings.review.mode} disabled={locked} onChange={(event) => patch({ review: { mode: event.target.value as Settings['review']['mode'], revealAfter: event.target.value === 'AFTER_DATE' ? settings.review.revealAfter : null } })}>
          {(['NEVER', 'AFTER_SUBMIT', 'AFTER_DATE'] as const).map((mode) => <option key={mode} value={mode}>{t(`ev.review.${mode}`)}</option>)}
        </select>
        {settings.review.mode === 'AFTER_DATE' ? <input type="datetime-local" aria-label={t('ev.settings.revealAfter')} className={field} value={toLocalInput(settings.review.revealAfter)} disabled={locked} onChange={(event) => patch({ review: { mode: 'AFTER_DATE', revealAfter: fromLocalInput(event.target.value) } })} /> : null}
      </fieldset>
      <LevelsEditor levels={settings.performance.levels} disabled={locked} onChange={(levels) => patch({ performance: { levels } })} />
      <SkillsEditor skills={skills} disabled={locked} onChange={setSkills} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={settings.ai.allowedDuringAttempt} disabled={locked} onChange={(event) => patch({ ai: { allowedDuringAttempt: event.target.checked } })} /><span>{t('ev.settings.ai')}<span className="block text-xs text-text-muted">{t('ev.settings.aiHint')}</span></span></label>
      {!locked ? <div className="flex items-center gap-3"><Button variant="accent" loading={busy} onClick={() => void save()}>{t('ev.settings.save')}</Button>{message ? <span role="status" className={cn('text-sm', message.ok ? 'text-success' : 'text-error')}>{message.text}</span> : null}</div> : null}
    </div>
  );
}

function AssignmentsTab({ organizationId, evaluationId, editable }: { organizationId: string; evaluationId: string; editable: boolean }) {
  const { t } = useI18n();
  const current = useResource(() => evaluationsApi.assignments(organizationId, evaluationId), [organizationId, evaluationId]);
  const subjects = useResource(() => listPermissionSubjects(organizationId), [organizationId]);
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (current.data) setRows(current.data); }, [current.data]);
  if (!rows) return <Skeleton className="h-24 w-full rounded-xl" />;
  const set = (index: number, patch: Partial<AssignmentRow>) => setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const valid = rows.every((row) => [row.role, row.groupId, row.userId].filter(Boolean).length === 1) && new Set(rows.map((row) => row.role ?? row.groupId ?? row.userId)).size === rows.length;
  const save = async () => {
    setBusy(true); setMessage(null);
    try { await evaluationsApi.setAssignments(organizationId, evaluationId, rows); setMessage({ ok: true, text: t('ev.assign.saved') }); void current.reload(); }
    catch (reason) { setMessage({ ok: false, text: reason instanceof Error ? reason.message : 'error' }); } finally { setBusy(false); }
  };
  const add = (kind: 'role' | 'groupId' | 'userId') => setRows([...rows, { [kind]: '', opensAt: null, closesAt: null } as AssignmentRow]);
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-text-secondary">{t('ev.assign.hint')}</p>
      {rows.length === 0 ? <p className="text-sm text-text-muted">{t('ev.assign.none')}</p> : null}
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1.2fr)_1fr_1fr_auto] sm:items-end">
            {row.role !== undefined ? <label className="space-y-1"><span className="ui-label">{t('ev.assign.role')}</span><select className={field} value={row.role} disabled={!editable} onChange={(event) => set(index, { role: event.target.value })}><option value="">{t('ev.assign.pick')}</option>{(subjects.data?.roles ?? []).map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
              : row.groupId !== undefined ? <label className="space-y-1"><span className="ui-label">{t('ev.assign.group')}</span><select className={field} value={row.groupId} disabled={!editable} onChange={(event) => set(index, { groupId: event.target.value })}><option value="">{t('ev.assign.pick')}</option>{(subjects.data?.groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              : <label className="space-y-1"><span className="ui-label">{t('ev.assign.person')}</span><select className={field} value={row.userId ?? ''} disabled={!editable} onChange={(event) => set(index, { userId: event.target.value })}><option value="">{t('ev.assign.pick')}</option>{(subjects.data?.memberships ?? []).map((m) => <option key={m.id} value={m.userId}>{m.name ?? m.userId}</option>)}</select></label>}
            <label className="space-y-1"><span className="ui-label">{t('ev.assign.opens')}</span><input type="datetime-local" className={field} value={toLocalInput(row.opensAt)} disabled={!editable} onChange={(event) => set(index, { opensAt: fromLocalInput(event.target.value) })} /></label>
            <label className="space-y-1"><span className="ui-label">{t('ev.assign.closes')}</span><input type="datetime-local" className={field} value={toLocalInput(row.closesAt)} disabled={!editable} onChange={(event) => set(index, { closesAt: fromLocalInput(event.target.value) })} /></label>
            {editable ? <Button variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== index))}>{t('ev.assign.remove')}</Button> : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => add('role')}>{t('ev.assign.addRole')}</Button>
          <Button size="sm" variant="outline" onClick={() => add('groupId')}>{t('ev.assign.addGroup')}</Button>
          <Button size="sm" variant="outline" onClick={() => add('userId')}>{t('ev.assign.addPerson')}</Button>
          <Button variant="accent" loading={busy} disabled={!valid} onClick={() => void save()}>{t('ev.assign.save')}</Button>
          {!valid ? <span className="text-xs text-text-muted">{t('ev.assign.invalid')}</span> : null}
          {message ? <span role="status" className={cn('text-sm', message.ok ? 'text-success' : 'text-error')}>{message.text}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function PublishTab({ organizationId, evaluationId, draft, canPublish }: { organizationId: string; evaluationId: string; draft: ReturnType<typeof useDraft>; canPublish: boolean }) {
  const { t } = useI18n();
  const versions = useResource(() => evaluationsApi.versions(organizationId, evaluationId), [organizationId, evaluationId]);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const where = (path: string) => { const m = /^questions\[(\d+)\]/.exec(path); return m ? t('ev.player.question', { n: Number(m[1]) + 1 }) : path; };
  const check = async () => { setBusy(true); try { await draft.commitAll(); setIssues((await evaluationsApi.validate(organizationId, evaluationId)).issues); } finally { setBusy(false); } };
  const publish = async () => {
    setBusy(true); setMessage(null);
    try {
      await draft.commitAll();
      const version = await evaluationsApi.publish(organizationId, evaluationId);
      setIssues([]); setMessage({ ok: true, text: t('ev.publish.done', { n: version.version }) });
      await draft.reload(); void versions.reload();
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'EVALUATION_INVALID') { setIssues((await evaluationsApi.validate(organizationId, evaluationId)).issues); setMessage({ ok: false, text: t('ev.publish.invalid') }); }
      else setMessage({ ok: false, text: reason instanceof Error ? reason.message : 'error' });
    } finally { setBusy(false); }
  };
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" loading={busy} onClick={() => void check()}>{t('ev.publish.check')}</Button>
        {canPublish ? <Button variant="accent" loading={busy} onClick={() => void publish()}><CloudArrowUp className="size-4" aria-hidden />{t('ev.publish.publish')}</Button> : null}
        {message ? <span role="status" className={cn('text-sm', message.ok ? 'text-success' : 'text-error')}>{message.text}</span> : null}
      </div>
      <p className="text-xs text-text-muted">{t('ev.publish.hint')}</p>
      {issues ? (issues.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle className="size-4" aria-hidden />{t('ev.publish.ready')}</p>
        : <ul className="space-y-1.5" aria-label={t('ev.publish.issues')}>{issues.map((issue, i) => <li key={i} className="flex items-start gap-2 text-sm text-warning"><WarningCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><span><strong className="font-medium">{where(issue.path)}</strong> — {ISSUES.has(issue.code) ? t(`ev.issue.${issue.code}` as 'ev.issue.EVALUATION_NO_QUESTIONS') : issue.message}</span></li>)}</ul>) : null}
      <section aria-label={t('ev.publish.versions')} className="space-y-2">
        <h3 className="ui-label">{t('ev.publish.versions')}</h3>
        {(versions.data ?? []).length === 0 ? <p className="text-sm text-text-muted">{t('ev.publish.noVersions')}</p> : (
          <ul className="space-y-1.5">{versions.data!.map((v) => <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"><span className="font-medium text-text">v{v.version}</span><span className="text-text-secondary">{t('ev.publish.versionMeta', { questions: v.questionCount, points: formatPoints(v.maxPoints), date: new Date(v.publishedAt).toLocaleString() })}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
