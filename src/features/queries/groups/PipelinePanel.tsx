import { useEffect, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { useResource } from '@/features/admin-center/hooks';
import { Loading, Notice, selectClass, useBusy } from '@/features/admin-center/ui';
import {
  DEFAULT_SOURCE, PIPELINE_STEPS, createScript, createVersion, listRuns, publishVersion, readPipeline, readScriptVersion, runPipeline,
  type ParamType, type PipelineParam, type PipelineStep, type ScriptVersion,
} from './pipelineApi';
import { slugOf, type GroupMember } from './groupsApi';

const allSteps = (): PipelineStep[] => PIPELINE_STEPS.map((id) => ({ id, enabled: true }));
const runTone = { SUCCEEDED: 'active', FAILED: 'error', BLOCKED: 'pending', RUNNING: 'pending', QUEUED: 'pending' } as const;

/** Scripts are plain text stored as immutable versions; this panel edits and publishes them but nothing here ever executes code. */
export function PipelinePanel({ organizationId, groupId, datasets }: { organizationId: string; groupId: string; datasets: GroupMember[] }) {
  const { t, locale } = useI18n();
  const overview = useResource(() => readPipeline(organizationId, groupId), [organizationId, groupId]);
  const runs = useResource(() => listRuns(organizationId, groupId).catch(() => []), [organizationId, groupId]);
  const { busy, error, ok, act, setError } = useBusy();
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [params, setParams] = useState<PipelineParam[]>([]);
  const [steps, setSteps] = useState<PipelineStep[]>(allSteps());
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [runParams, setRunParams] = useState<Record<string, string>>({});
  const [runDataset, setRunDataset] = useState('');
  const data = overview.data;
  const script = data?.scripts.find((item) => item.id === scriptId) ?? null;

  useEffect(() => { if (data && !scriptId && data.scripts[0]) setScriptId(data.scripts[0].id); }, [data, scriptId]);
  const load = (version: ScriptVersion) => { setSource(version.source ?? ''); setParams(version.params); setSteps(version.steps.length ? version.steps : allSteps()); setNote(''); };
  const open = async (version: ScriptVersion) => { if (!script) return; load(await readScriptVersion(organizationId, groupId, script.id, version.id)); };
  useEffect(() => { const latest = script?.versions[0]; if (script && latest) void readScriptVersion(organizationId, groupId, script.id, latest.id).then(load).catch(() => undefined); else { setSource(DEFAULT_SOURCE); setParams([]); setSteps(allSteps()); } }, [script?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = async () => { await Promise.all([overview.reload(), runs.reload()]); };

  if (overview.status === 'loading') return <Loading />;
  if (overview.status !== 'ready' || !data) return <Notice error={overview.error} />;
  const setStep = (id: string, enabled: boolean) => setSteps((current) => current.map((step) => (step.id === id ? { ...step, enabled } : step)));
  const setParam = (index: number, patch: Partial<PipelineParam>) => setParams((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const typed = (param: PipelineParam, raw: string) => (raw === '' ? undefined : param.type === 'number' ? Number(raw) : param.type === 'boolean' ? raw === 'true' : raw);

  return (
    <div className="space-y-4">
      <p role="note" className={`rounded-lg border px-3 py-2 text-xs ${data.runnerEnabled ? 'border-border text-text-secondary' : 'border-warning/40 bg-warning/5 text-warning'}`}>{data.runnerEnabled ? t('dg.pl.runnerOn') : t('dg.pl.runnerOff')}</p>
      <Notice error={error} ok={ok} />

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <select className={`${selectClass} min-w-0 flex-1`} aria-label={t('dg.pl.script')} value={scriptId ?? ''} onChange={(event) => setScriptId(event.target.value || null)}>
            <option value="">{t('dg.pl.noScript')}</option>
            {data.scripts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === 'ARCHIVED' ? ` (${t('dg.archived')})` : ''}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Input value={name} maxLength={100} placeholder={t('dg.pl.newName')} aria-label={t('dg.pl.newName')} onChange={(event) => setName(event.target.value)} />
          <Button variant="secondary" loading={busy === 'script'} disabled={name.trim().length < 2} onClick={() => void act('script', async () => { const created = await createScript(organizationId, groupId, { slug: slugOf(name), name: name.trim() }); setName(''); await reload(); setScriptId(created.id); }, t('dg.saved'))}><Plus />{t('dg.pl.create')}</Button>
        </div>
      </section>

      {script ? (
        <>
          <section className="space-y-2">
            <h3 className="ui-label">{t('dg.pl.source')}</h3>
            <textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} aria-label={t('dg.pl.source')} rows={14} maxLength={262144}
              className="w-full rounded-md border border-border bg-surface p-2 font-mono text-xs text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25" />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="ui-label">{t('dg.pl.params')}</h3><Button size="sm" variant="ghost" onClick={() => setParams((current) => [...current, { name: '', type: 'string', required: false }])}><Plus className="size-3.5" />{t('dg.pl.addParam')}</Button></div>
            {params.length === 0 ? <p className="text-xs text-text-muted">{t('dg.pl.noParams')}</p> : params.map((param, index) => (
              <div key={index} className="grid grid-cols-[1fr_6.5rem_1fr_auto_auto] items-center gap-1.5 text-xs">
                <Input aria-label={t('dg.pl.paramName')} value={param.name} maxLength={40} placeholder="currency" onChange={(event) => setParam(index, { name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
                <select className={selectClass} aria-label={t('dg.pl.paramType')} value={param.type} onChange={(event) => setParam(index, { type: event.target.value as ParamType, default: undefined })}>{(['string', 'number', 'boolean', 'date'] as const).map((type) => <option key={type} value={type}>{type}</option>)}</select>
                <Input aria-label={t('dg.pl.paramDefault')} value={param.default === undefined ? '' : String(param.default)} placeholder={t('dg.pl.paramDefault')} type={param.type === 'date' ? 'date' : 'text'} onChange={(event) => setParam(index, { default: typed(param, event.target.value) })} />
                <label className="flex items-center gap-1"><input type="checkbox" checked={param.required} onChange={(event) => setParam(index, { required: event.target.checked })} className="size-4 accent-(--color-accent)" />{t('dg.pl.required')}</label>
                <Button size="sm" variant="ghost" aria-label={t('dg.ds.remove')} onClick={() => setParams((current) => current.filter((_, i) => i !== index))}><Trash className="size-3.5" /></Button>
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="ui-label">{t('dg.pl.steps')}</h3>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {steps.map((step) => <li key={step.id}><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={step.enabled} onChange={(event) => setStep(step.id, event.target.checked)} className="size-4 accent-(--color-accent)" />{t(`dg.pl.step.${step.id}`)}</label></li>)}
            </ul>
          </section>

          <div className="flex gap-2">
            <Input value={note} maxLength={300} placeholder={t('dg.pl.note')} aria-label={t('dg.pl.note')} onChange={(event) => setNote(event.target.value)} />
            <Button variant="accent" loading={busy === 'version'} disabled={script.status !== 'ACTIVE' || source.trim().length === 0 || params.some((param) => !param.name)} onClick={() => void act('version', async () => { await createVersion(organizationId, groupId, script.id, { source, params, steps, note: note.trim() || undefined }); setNote(''); await reload(); }, t('dg.saved'))}>{t('dg.pl.saveVersion')}</Button>
          </div>

          <section className="space-y-1.5">
            <h3 className="ui-label">{t('dg.pl.versions')}</h3>
            {script.versions.length === 0 ? <p className="text-xs text-text-muted">{t('dg.pl.noVersions')}</p> : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                {script.versions.map((version) => (
                  <li key={version.id} className="space-y-1.5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">v{version.version}</span>
                      <span className="mono-data text-text-muted">{version.sourceSha256.slice(0, 8)}</span>
                      {data.activeScriptVersionId === version.id ? <Status tone="active">{t('dg.pl.active')}</Status> : null}
                      <time className="ml-auto text-text-muted" dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString(locale)}</time>
                    </div>
                    {version.note ? <p className="text-text-secondary">{version.note}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => void act('open', () => open(version))}>{t('dg.pl.load')}</Button>
                      {data.activeScriptVersionId === version.id
                        ? <Button size="sm" variant="ghost" loading={busy === 'unpublish'} onClick={() => void act('unpublish', async () => { await publishVersion(organizationId, groupId, null); await reload(); }, t('dg.saved'))}>{t('dg.pl.unpublish')}</Button>
                        : <Button size="sm" variant="secondary" loading={busy === `pub-${version.id}`} onClick={() => void act(`pub-${version.id}`, async () => { await publishVersion(organizationId, groupId, version.id); await reload(); }, t('dg.saved'))}>{data.activeScriptVersionId ? t('dg.pl.publishVersion') : t('dg.pl.publish')}</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {script.versions[0] ? (
            <section className="space-y-2 rounded-lg border border-border p-3">
              <h3 className="ui-label">{t('dg.pl.run')}</h3>
              <select className={`${selectClass} w-full`} aria-label={t('dg.pl.runDataset')} value={runDataset} onChange={(event) => setRunDataset(event.target.value)}>
                <option value="">{t('dg.pl.runDatasetNone')}</option>
                {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.periodLabel ?? dataset.slug}</option>)}
              </select>
              {script.versions[0].params.map((param) => (
                <label key={param.name} className="block space-y-1 text-xs"><span className="text-text-secondary">{param.name}{param.required ? ' *' : ''}</span>
                  <Input type={param.type === 'date' ? 'date' : 'text'} value={runParams[param.name] ?? ''} placeholder={param.default === undefined ? '' : String(param.default)} onChange={(event) => setRunParams((current) => ({ ...current, [param.name]: event.target.value }))} /></label>
              ))}
              <div className="flex flex-wrap gap-2">
                {(['TEST', 'REPROCESS'] as const).map((kind) => (
                  <Button key={kind} variant="secondary" loading={busy === kind} disabled={kind === 'REPROCESS' && !runDataset} onClick={() => void act(kind, async () => {
                    const version = script.versions[0]!;
                    const values = Object.fromEntries(version.params.flatMap((param) => { const value = typed(param, runParams[param.name] ?? ''); return value === undefined ? [] : [[param.name, value]]; }));
                    const run = await runPipeline(organizationId, groupId, { scriptVersionId: data.activeScriptVersionId ?? version.id, kind, ...(runDataset ? { datasetId: runDataset } : {}), params: values });
                    if (run.status === 'BLOCKED') setError(t('dg.pl.blocked'));
                    await reload();
                  })}>{t(kind === 'TEST' ? 'dg.pl.runTest' : 'dg.pl.runReprocess')}</Button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="space-y-1.5">
        <h3 className="ui-label">{t('dg.pl.history')}</h3>
        {(runs.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('dg.pl.noRuns')}</p> : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
            {(runs.data ?? []).slice(0, 10).map((run) => (
              <li key={run.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <Status tone={runTone[run.status]}>{run.status}</Status><span>{run.kind}</span>
                {run.errorCode ? <span className="mono-data text-text-muted">{run.errorCode}</span> : null}
                <time className="ml-auto text-text-muted" dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString(locale)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
