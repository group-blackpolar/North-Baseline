import { useState } from 'react';
import { ArrowDown, ArrowUp, CaretDown, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { evaluationsApi } from './api';
import { blocksToText, formatPoints, type Block, hiddenBlockCount, optionLabel, questionIssues, textToBlocks, type AuthorQuestion } from './model';
import type { useDraft } from './useDraft';

type Draft = ReturnType<typeof useDraft>;
const field = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60';
const newOptionId = () => globalThis.crypto.randomUUID();

/** Sections, reference texts and questions of the draft. Any number of questions and options; the correct option is marked per question. */
export function ContentEditor({ organizationId, evaluationId, draft, locked }: { organizationId: string; evaluationId: string; draft: Draft; locked: boolean }) {
  const { t } = useI18n();
  const content = draft.view!.content;
  const [openId, setOpenId] = useState<string | null>(content.questions[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const guard = async (work: () => Promise<unknown>) => { setBusy(true); try { await work(); } catch { /* the draft hook reports it */ } finally { setBusy(false); } };

  const addSection = () => guard(() => draft.structural((rev) => evaluationsApi.addSection(organizationId, evaluationId, t('ev.builder.newSection', { n: content.sections.length + 1 }), rev)));
  const addQuestion = (sectionId: string) => guard(async () => {
    const result = await draft.structural((rev) => evaluationsApi.addQuestion(organizationId, evaluationId, { sectionId, options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }] }, rev));
    if (result.id) setOpenId(result.id);
  });
  const addPassage = () => guard(() => draft.structural((rev) => evaluationsApi.addPassage(organizationId, evaluationId, { title: t('ev.builder.newPassage'), body: [] }, rev)));
  const move = (index: number, by: -1 | 1) => {
    const ids = content.questions.map((q) => q.id); const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void guard(() => draft.structural((rev) => evaluationsApi.reorderQuestions(organizationId, evaluationId, ids, rev)));
  };
  const remove = (q: AuthorQuestion) => guard(() => draft.structural((rev) => evaluationsApi.removeQuestion(organizationId, evaluationId, q.id, rev)));
  const totalPoints = content.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">{t('ev.builder.summary', { questions: content.questions.length, points: formatPoints(totalPoints) })}</p>

      <section aria-label={t('ev.builder.passages')} className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-display text-base font-semibold text-text">{t('ev.builder.passages')}</h3><Button size="sm" variant="outline" disabled={locked || busy} onClick={() => void addPassage()}><Plus className="size-4" aria-hidden />{t('ev.builder.addPassage')}</Button></div>
        <p className="text-xs text-text-muted">{t('ev.builder.passagesHint')}</p>
        {content.passages.map((passage) => (
          <PassageCard key={passage.id} passage={passage} locked={locked} onSave={(input) => draft.run((rev) => evaluationsApi.updatePassage(organizationId, evaluationId, passage.id, input, rev)).then(() => draft.reload())}
            onRemove={() => guard(() => draft.structural((rev) => evaluationsApi.removePassage(organizationId, evaluationId, passage.id, rev)))} />
        ))}
      </section>

      {content.sections.map((section) => {
        const inSection = content.questions.map((q, index) => ({ q, index })).filter((item) => item.q.sectionId === section.id);
        return (
          <section key={section.id} aria-label={section.title} className="space-y-3 rounded-2xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SectionTitle value={section.title} disabled={locked} onCommit={(title) => void draft.run((rev) => evaluationsApi.updateSection(organizationId, evaluationId, section.id, title, rev)).then(() => draft.reload())} label={t('ev.builder.sectionTitle')} />
              <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.removeSection')} disabled={locked || busy || inSection.length > 0 || content.sections.length < 2} title={inSection.length ? t('ev.builder.sectionNotEmpty') : undefined}
                onClick={() => void guard(() => draft.structural((rev) => evaluationsApi.removeSection(organizationId, evaluationId, section.id, rev)))}><Trash className="size-4" aria-hidden /></Button>
            </div>
            <ol className="space-y-2">
              {inSection.map(({ q, index }) => (
                <QuestionCard key={q.id} q={q} index={index} total={content.questions.length} open={openId === q.id} locked={locked || busy}
                  onToggle={() => setOpenId(openId === q.id ? null : q.id)} onMove={(by) => move(index, by)} onRemove={() => void remove(q)}
                  onEdit={(patch) => draft.editQuestion(q.id, patch)} onCorrect={(optionId) => void draft.setCorrect(q.id, optionId)}
                  onReview={() => void draft.commitQuestion(q.id).then(() => draft.run((rev) => evaluationsApi.updateQuestion(organizationId, evaluationId, q.id, { aiDraft: false }, rev))).then(() => draft.reload()).catch(() => undefined)}
                  passages={content.passages} sections={content.sections} />
              ))}
            </ol>
            <Button size="sm" variant="secondary" disabled={locked || busy} onClick={() => void addQuestion(section.id)}><Plus className="size-4" aria-hidden />{t('ev.builder.addQuestion')}</Button>
          </section>
        );
      })}
      <Button variant="outline" disabled={locked || busy} onClick={() => void addSection()}><Plus className="size-4" aria-hidden />{t('ev.builder.addSection')}</Button>
    </div>
  );
}

/** Paragraph text <-> blocks with local text state, so blank lines can be typed (the blocks never overwrite what is being typed). */
function BlockTextArea({ blocks, onChange, disabled, className, placeholder }: { blocks: Block[]; onChange: (blocks: Block[]) => void; disabled: boolean; className?: string; placeholder?: string }) {
  const [text, setText] = useState(() => blocksToText(blocks));
  return <textarea className={className} value={text} disabled={disabled} placeholder={placeholder} onChange={(event) => { setText(event.target.value); onChange(textToBlocks(event.target.value, blocks)); }} />;
}

function SectionTitle({ value, disabled, onCommit, label }: { value: string; disabled: boolean; onCommit: (value: string) => void; label: string }) {
  const [text, setText] = useState(value);
  return <input aria-label={label} className={cn(field, 'min-w-0 flex-1 font-display font-semibold')} value={text} maxLength={200} disabled={disabled} onChange={(event) => setText(event.target.value)} onBlur={() => { if (text !== value) onCommit(text); }} />;
}

function PassageCard({ passage, locked, onSave, onRemove }: { passage: { id: string; title: string; body: Parameters<typeof blocksToText>[0] }; locked: boolean; onSave: (input: { title: string; body: ReturnType<typeof textToBlocks> }) => Promise<unknown>; onRemove: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(passage.title);
  const [body, setBody] = useState(blocksToText(passage.body));
  const hidden = hiddenBlockCount(passage.body);
  const save = () => { if (title !== passage.title || body !== blocksToText(passage.body)) void onSave({ title, body: textToBlocks(body, passage.body) }).catch(() => undefined); };
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2"><input aria-label={t('ev.builder.passageTitle')} className={cn(field, 'flex-1')} value={title} maxLength={200} disabled={locked} onChange={(event) => setTitle(event.target.value)} onBlur={save} /><Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.removePassage')} disabled={locked} onClick={onRemove}><Trash className="size-4" aria-hidden /></Button></div>
      <textarea aria-label={t('ev.builder.passageBody')} className={cn(field, 'min-h-32 resize-y leading-6')} value={body} disabled={locked} onChange={(event) => setBody(event.target.value)} onBlur={save} placeholder={t('ev.builder.passagePlaceholder')} />
      {hidden ? <p className="text-xs text-text-muted">{t('ev.builder.keptBlocks', { n: hidden })}</p> : null}
    </div>
  );
}

function QuestionCard({ q, index, total, open, locked, passages, sections, onToggle, onMove, onRemove, onEdit, onCorrect, onReview }: {
  q: AuthorQuestion; index: number; total: number; open: boolean; locked: boolean; passages: Array<{ id: string; title: string }>; sections: Array<{ id: string; title: string }>;
  onToggle: () => void; onMove: (by: -1 | 1) => void; onRemove: () => void; onEdit: (patch: Partial<AuthorQuestion>) => void; onCorrect: (optionId: string) => void; onReview: () => void;
}) {
  const { t } = useI18n();
  const issues = questionIssues(q);
  const summary = blocksToText(q.prompt).replace(/\s+/g, ' ').slice(0, 90) || t('ev.builder.noStatement');
  const hiddenPrompt = hiddenBlockCount(q.prompt), hiddenExplanation = hiddenBlockCount(q.explanation);
  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-1 p-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          <CaretDown className={cn('size-4 shrink-0 transition-transform', open ? '' : '-rotate-90')} aria-hidden />
          <span className="shrink-0 font-display text-sm font-semibold text-text">{t('ev.player.question', { n: index + 1 })}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{summary}</span>
          {q.aiDraft ? <span className="inline-flex shrink-0 items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">{t('ev.builder.aiDraft')}</span> : null}
          {issues.length ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warning"><WarningCircle className="size-4" aria-hidden /><span className="hidden sm:inline">{t('ev.builder.incomplete')}</span></span> : null}
        </button>
        <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.moveUp')} disabled={locked || index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-4" aria-hidden /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.moveDown')} disabled={locked || index === total - 1} onClick={() => onMove(1)}><ArrowDown className="size-4" aria-hidden /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.removeQuestion')} disabled={locked} onClick={onRemove}><Trash className="size-4" aria-hidden /></Button>
      </div>
      {open ? (
        <div className="space-y-4 border-t border-border p-3 sm:p-4">
          {q.aiDraft ? (
            <div role="note" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
              <span className="min-w-0 flex-1 basis-56 text-text">{t('ev.builder.aiHint')}</span>
              <Button size="sm" variant="accent" disabled={locked} onClick={() => onReview()}>{t('ev.builder.markReviewed')}</Button>
            </div>
          ) : null}
          <label className="block space-y-1"><span className="ui-label">{t('ev.builder.statement')}</span>
            <BlockTextArea key={`${q.id}-p`} className={cn(field, 'min-h-24 resize-y leading-6')} blocks={q.prompt} disabled={locked} onChange={(prompt) => onEdit({ prompt })} /></label>
          {hiddenPrompt ? <p className="text-xs text-text-muted">{t('ev.builder.keptBlocks', { n: hiddenPrompt })}</p> : null}
          <fieldset className="space-y-2">
            <legend className="ui-label pb-1">{t('ev.builder.options')}</legend>
            <p className="text-xs text-text-muted">{t('ev.builder.optionsHint')}</p>
            {q.options.map((option, position) => (
              <div key={option.id} className="flex items-center gap-2">
                <input type="radio" name={`correct-${q.id}`} aria-label={t('ev.builder.markCorrect', { label: optionLabel(position) })} className="size-5 shrink-0 accent-[var(--color-accent)]" checked={q.correctOptionId === option.id} disabled={locked} onChange={() => onCorrect(option.id)} />
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-semibold">{optionLabel(position)}</span>
                <input aria-label={t('ev.builder.optionText', { label: optionLabel(position) })} className={cn(field, 'min-w-0 flex-1', q.correctOptionId === option.id && 'border-success/60')} value={option.text} maxLength={2000} disabled={locked}
                  onChange={(event) => onEdit({ options: q.options.map((o) => (o.id === option.id ? { ...o, text: event.target.value } : o)) })} />
                <Button size="icon-sm" variant="ghost" aria-label={t('ev.builder.removeOption', { label: optionLabel(position) })} disabled={locked || q.options.length <= 2} onClick={() => onEdit({ options: q.options.filter((o) => o.id !== option.id), ...(q.correctOptionId === option.id ? { correctOptionId: null } : {}) })}><Trash className="size-4" aria-hidden /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={locked || q.options.length >= 12} onClick={() => onEdit({ options: [...q.options, { id: newOptionId(), text: '' }] })}><Plus className="size-4" aria-hidden />{t('ev.builder.addOption')}</Button>
            {!q.correctOptionId ? <p role="status" className="text-xs text-warning">{t('ev.builder.markOne')}</p> : null}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1"><span className="ui-label">{t('ev.builder.points')}</span><input type="number" inputMode="decimal" min={0.01} max={1000} step={0.25} className={field} defaultValue={q.points} disabled={locked} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0) onEdit({ points: Math.round(value * 100) / 100 }); }} /></label>
            <label className="space-y-1"><span className="ui-label">{t('ev.builder.category')}</span><input className={field} value={q.category ?? ''} maxLength={80} disabled={locked} placeholder={t('ev.builder.categoryHint')} onChange={(event) => onEdit({ category: event.target.value.trim() ? event.target.value : null })} /></label>
            <label className="space-y-1"><span className="ui-label">{t('ev.builder.passage')}</span><select className={field} value={q.passageId ?? ''} disabled={locked} onChange={(event) => onEdit({ passageId: event.target.value || null })}><option value="">{t('ev.builder.noPassage')}</option>{passages.map((p) => <option key={p.id} value={p.id}>{p.title || t('ev.player.text')}</option>)}</select></label>
            <label className="space-y-1"><span className="ui-label">{t('ev.builder.section')}</span><select className={field} value={q.sectionId} disabled={locked || sections.length < 2} onChange={(event) => onEdit({ sectionId: event.target.value })}>{sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          </div>
          <label className="block space-y-1"><span className="ui-label">{t('ev.builder.explanation')}</span>
            <BlockTextArea key={`${q.id}-e`} className={cn(field, 'min-h-20 resize-y leading-6')} blocks={q.explanation} disabled={locked} onChange={(explanation) => onEdit({ explanation })} placeholder={t('ev.builder.explanationHint')} /></label>
          {hiddenExplanation ? <p className="text-xs text-text-muted">{t('ev.builder.keptBlocks', { n: hiddenExplanation })}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
