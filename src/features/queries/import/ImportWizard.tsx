import { ArrowRight, CheckCircle, CircleNotch, FileXls, UploadSimple, WarningCircle, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { queryDataset } from '@/features/analytics/datasetQuery';
import { ApiError } from '@/lib/api';
import { listDatasets, type DatasetField, type DatasetSummary } from '@/features/admin-center/api';
import { localName } from '@/features/views/workspace/resources';
import {
  activateImport, cancelImport, confirmImport, createDataset, createMapping, fieldsOf, newIdempotencyKey, prepareImport, readAnalysis, readImport, sha256Hex, uploadToSignedUrl,
  type ImportAnalysis, type ImportJob,
} from './importApi';
import { FAILED_STATES, FIELD_TYPES, IMPORT_STAGES, slugFromName, stageIndex, suggestMapping, toMappingInput, validateDrafts, type ColumnDraft, type FieldType } from './mappingModel';

type Step = 'dataset' | 'file' | 'mapping' | 'result';
const MAX_BYTES = 50 * 1024 * 1024;
const delay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/**
 * Official dataset import: pick or create the dataset, upload the XLSX straight to private storage, follow the server-side
 * security checks and analysis, review the column mapping, choose how to treat exact duplicates and activate. Nothing is
 * parsed in the browser; every state shown is the job state CORECROW reports.
 */
export function ImportWizard({ organizationId, open, onOpenChange, initialDatasetId, onDone }: { organizationId: string; open: boolean; onOpenChange: (open: boolean) => void; initialDatasetId?: string | null; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>('dataset');
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId ?? '');
  const [newName, setNewName] = useState('');
  const [existingFields, setExistingFields] = useState<DatasetField[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [drafts, setDrafts] = useState<ColumnDraft[]>([]);
  const [duplicates, setDuplicates] = useState<'KEEP' | 'SKIP_EXACT'>('SKIP_EXACT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale), [locale]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('dataset'); setFile(null); setJob(null); setUploadFraction(null); setAnalysis(null); setDrafts([]); setBusy(false); setError(null); setRows(null); setNewName('');
    setDatasetId(initialDatasetId ?? '');
  }, [initialDatasetId]);
  useEffect(() => { if (!open) reset(); }, [open, reset]);
  useEffect(() => { if (open) void listDatasets(organizationId).then((list) => setDatasets(list.filter((item) => item.status === 'ACTIVE'))).catch(() => setDatasets([])); }, [open, organizationId]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const describe = (reason: unknown) => (reason instanceof ApiError ? `${reason.message}${reason.code ? ` (${reason.code})` : ''}` : reason instanceof Error ? reason.message : t('imp.error'));

  /** Polls the job until `done(status)` or a terminal failure. The signal ends the loop when the dialog closes. */
  const follow = useCallback(async (id: string, ds: string, done: (status: string) => boolean, signal: AbortSignal): Promise<ImportJob> => {
    for (let wait = 1_000; ; wait = Math.min(wait + 500, 3_000)) {
      const current = await readImport(organizationId, ds, id, signal);
      setJob(current);
      if (done(current.status)) return current;
      if (FAILED_STATES.has(current.status)) throw new Error(`${t('imp.failed')}: ${current.errorCode ?? current.status}`);
      await delay(wait, signal);
    }
  }, [organizationId, t]);

  const chooseDataset = async () => {
    setBusy(true); setError(null);
    try {
      let id = datasetId;
      if (!id) {
        const name = newName.trim();
        if (!name) throw new Error(t('imp.nameRequired'));
        id = (await createDataset(organizationId, { name, slug: slugFromName(name) || 'dataset' })).id;
        setDatasetId(id);
      }
      setExistingFields(await fieldsOf(organizationId, id).catch(() => []));
      setStep('file');
    } catch (reason) { setError(describe(reason)); } finally { setBusy(false); }
  };

  const upload = async () => {
    if (!file || !datasetId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setError(null); setUploadFraction(0); setJob(null);
    try {
      if (file.size > MAX_BYTES) throw new Error(t('imp.tooLarge', { mb: MAX_BYTES / 1024 / 1024 }));
      const checksum = await sha256Hex(file);
      const prepared = await prepareImport(organizationId, datasetId, file, checksum, newIdempotencyKey());
      setJob(prepared.import);
      await uploadToSignedUrl(prepared.upload, file, setUploadFraction, controller.signal);
      setUploadFraction(1);
      setJob(await confirmImport(organizationId, datasetId, prepared.import.id));
      await follow(prepared.import.id, datasetId, (status) => status === 'AWAITING_MAPPING', controller.signal);
      const found = await readAnalysis(organizationId, datasetId, prepared.import.id);
      setAnalysis(found);
      setDrafts(suggestMapping(found.workbook.sheets[0]!, existingFields));
      setStep('mapping');
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(describe(reason));
    } finally { setBusy(false); }
  };

  const issues = useMemo(() => validateDrafts(drafts), [drafts]);
  const issueOf = (ordinal: number) => issues.find((issue) => issue.ordinal === ordinal);

  const activate = async () => {
    if (!analysis || !job || issues.length) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setError(null); setStep('result');
    try {
      const mapping = await createMapping(organizationId, job.datasetId, job.id, toMappingInput(analysis.workbook.sheets[0]!.ordinal, drafts, duplicates));
      setJob(await activateImport(organizationId, job.datasetId, job.id, mapping.id));
      await follow(job.id, job.datasetId, (status) => status === 'SUCCEEDED', controller.signal);
      const count = await queryDataset(organizationId, job.datasetId, { mode: 'AGGREGATE', measures: [{ operation: 'COUNT', alias: 'rows' }] }).catch(() => null);
      const value = count?.rows[0]?.rows;
      setRows(typeof value === 'number' ? value : Number(value) || null);
      onDone();
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(describe(reason));
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    abortRef.current?.abort();
    if (job && !['SUCCEEDED', 'CANCELLED'].includes(job.status)) await cancelImport(organizationId, job.datasetId, job.id).catch(() => undefined);
    onOpenChange(false);
  };

  const update = (ordinal: number, patch: Partial<ColumnDraft>) => setDrafts((current) => current.map((draft) => (draft.ordinal === ordinal ? { ...draft, ...patch } : draft)));
  const select = 'h-8 rounded-md border border-border bg-surface px-1.5 text-xs outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25';
  const stageLabel = (stage: string) => t(`imp.stage.${stage}` as 'imp.stage.SUCCEEDED');
  const stageNow = job ? stageIndex(job.status) : -1;

  return (
    <DialogFrame open={open} onOpenChange={(next) => { if (!next) void cancel(); else onOpenChange(true); }} label={t('imp.title')} size="lg">
      <div className="space-y-4">
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileXls className="size-5" weight="fill" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><h2 className="font-display text-base font-semibold text-text">{t('imp.title')}</h2><p className="text-xs text-text-secondary">{t(`imp.hint.${step}` as 'imp.hint.dataset')}</p></div>
          <button type="button" aria-label={t('common.close')} onClick={() => void cancel()} className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text"><X className="size-4" /></button>
        </header>

        {error ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-xs text-error"><WarningCircle className="mt-px size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{error}</span></p> : null}

        {step === 'dataset' ? (
          <div className="space-y-3">
            <label className="block space-y-1"><span className="ui-label">{t('imp.existing')}</span>
              <select value={datasetId} onChange={(event) => setDatasetId(event.target.value)} className={cn(select, 'w-full')}>
                <option value="">{t('imp.createNew')}</option>
                {(datasets ?? []).map((dataset) => <option key={dataset.id} value={dataset.id}>{localName(dataset.name, locale)}</option>)}
              </select>
            </label>
            {!datasetId ? <label className="block space-y-1"><span className="ui-label">{t('imp.newName')}</span><Input value={newName} maxLength={100} onChange={(event) => setNewName(event.target.value)} placeholder="Master House" /></label> : <p className="text-xs text-text-muted">{t('imp.replaceNote')}</p>}
            <div className="flex justify-end"><Button variant="accent" loading={busy} onClick={() => void chooseDataset()} disabled={!datasetId && !newName.trim()}>{t('imp.next')}<ArrowRight className="size-4" /></Button></div>
          </div>
        ) : null}

        {step === 'file' ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:border-accent hover:bg-accent-soft/40">
              <UploadSimple className="size-6 text-text-muted" aria-hidden="true" />
              <span className="text-sm font-medium text-text">{file ? file.name : t('imp.choose')}</span>
              <span className="text-xs text-text-muted">{file ? `${number.format(Math.round(file.size / 1024))} KB` : t('imp.formats', { mb: MAX_BYTES / 1024 / 1024 })}</span>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setJob(null); setError(null); }} />
            </label>
            {busy || job ? (
              <ol className="space-y-1.5 rounded-lg border border-border p-3 text-xs" aria-live="polite">
                {IMPORT_STAGES.slice(0, 5).map((stage, index) => {
                  const state = index < stageNow || (stage === 'AWAITING_UPLOAD' && uploadFraction === 1) ? 'done' : index === stageNow || (stage === 'AWAITING_UPLOAD' && uploadFraction !== null) ? 'active' : 'todo';
                  return (
                    <li key={stage} className="flex items-center gap-2">
                      {state === 'done' ? <CheckCircle className="size-4 text-success" weight="fill" aria-hidden="true" /> : state === 'active' ? <CircleNotch className="size-4 animate-spin text-accent" aria-hidden="true" /> : <span className="size-4 rounded-full border border-border" aria-hidden="true" />}
                      <span className={cn(state === 'todo' && 'text-text-muted')}>{stageLabel(stage)}{stage === 'AWAITING_UPLOAD' && uploadFraction !== null && uploadFraction < 1 ? ` · ${Math.round(uploadFraction * 100)}%` : ''}</span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep('dataset')} disabled={busy}>{t('imp.back')}</Button><Button variant="accent" loading={busy} disabled={!file} onClick={() => void upload()}>{t('imp.upload')}</Button></div>
          </div>
        ) : null}

        {step === 'mapping' && analysis ? (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">{t('imp.analysis', { sheet: analysis.workbook.sheets[0]!.name, rows: number.format(Math.max(0, analysis.workbook.sheets[0]!.rowCount - 1)), columns: analysis.workbook.sheets[0]!.columnCount })}</p>
            <div className="max-h-[22rem] overflow-auto rounded-lg border border-border">
              <table className="w-full border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 bg-surface"><tr>{[t('imp.col.source'), t('imp.col.action'), t('imp.col.key'), t('imp.col.type'), t('imp.col.filled')].map((label) => <th key={label} scope="col" className="border-b border-border px-2 py-2 font-semibold text-text-muted">{label}</th>)}</tr></thead>
                <tbody>
                  {drafts.map((draft) => {
                    const issue = issueOf(draft.ordinal);
                    return (
                      <tr key={draft.ordinal} className={cn(draft.action === 'IGNORE' && 'opacity-55')}>
                        <td className="border-b border-border/60 px-2 py-1.5 font-medium">{draft.header ?? `#${draft.ordinal + 1}`}</td>
                        <td className="border-b border-border/60 px-2 py-1.5">
                          <select aria-label={t('imp.col.action')} value={draft.action} onChange={(event) => update(draft.ordinal, { action: event.target.value as ColumnDraft['action'] })} className={select}>
                            {draft.fieldId ? <option value="MAP">{t('imp.action.map')}</option> : null}<option value="CREATE">{t('imp.action.create')}</option><option value="IGNORE">{t('imp.action.ignore')}</option>
                          </select>
                        </td>
                        <td className="border-b border-border/60 px-2 py-1.5"><input aria-label={t('imp.col.key')} aria-invalid={Boolean(issue)} value={draft.key} disabled={draft.action !== 'CREATE'} onChange={(event) => update(draft.ordinal, { key: event.target.value })} className={cn(select, 'w-44 font-mono', issue && 'border-error')} />{issue ? <span className="mt-0.5 block text-[10px] text-error">{t(`imp.issue.${issue.code}` as 'imp.issue.KEY_INVALID')}</span> : null}</td>
                        <td className="border-b border-border/60 px-2 py-1.5"><select aria-label={t('imp.col.type')} value={draft.type} disabled={draft.action !== 'CREATE'} onChange={(event) => update(draft.ordinal, { type: event.target.value as FieldType })} className={select}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></td>
                        <td className="border-b border-border/60 px-2 py-1.5 tabular-nums text-text-muted">{number.format(draft.nonEmptyCount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
              <input type="checkbox" checked={duplicates === 'SKIP_EXACT'} onChange={(event) => setDuplicates(event.target.checked ? 'SKIP_EXACT' : 'KEEP')} className="mt-0.5 size-4 accent-(--color-accent)" />
              <span><span className="block font-medium text-text">{t('imp.skipDuplicates')}</span><span className="text-text-muted">{t('imp.skipDuplicatesHint')}</span></span>
            </label>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep('file')}>{t('imp.back')}</Button><Button variant="accent" disabled={issues.length > 0} onClick={() => void activate()}>{t('imp.import')}</Button></div>
          </div>
        ) : null}

        {step === 'result' ? (
          <div className="space-y-3 text-center">
            {job?.status === 'SUCCEEDED' ? (
              <>
                <CheckCircle className="mx-auto size-10 text-success" weight="fill" aria-hidden="true" />
                <p className="text-sm font-medium text-text">{t('imp.done')}</p>
                {rows !== null ? <p className="text-xs text-text-secondary">{t('imp.rows', { n: number.format(rows) })}</p> : null}
                <Button variant="accent" onClick={() => onOpenChange(false)}>{t('imp.close')}</Button>
              </>
            ) : error ? (
              <Button variant="secondary" onClick={() => setStep('mapping')}>{t('imp.back')}</Button>
            ) : (
              <>
                <CircleNotch className="mx-auto size-8 animate-spin text-accent" aria-hidden="true" />
                <p className="text-sm text-text" aria-live="polite">{job ? stageLabel(job.status) : t('imp.working')}</p>
                <p className="text-xs text-text-muted">{t('imp.workingHint')}</p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </DialogFrame>
  );
}
