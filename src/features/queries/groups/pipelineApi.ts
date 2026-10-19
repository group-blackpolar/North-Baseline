import { apiRequest } from '@/lib/api';

const base = (organizationId: string, groupId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}/dataset-groups/${encodeURIComponent(groupId)}`;

export const PIPELINE_STEPS = ['receive', 'validate_schema', 'normalize_columns', 'clean_values', 'normalize_dates_currencies', 'detect_duplicates', 'validate_rules', 'quality_report', 'import', 'publish', 'audit'] as const;
export type PipelineStepId = (typeof PIPELINE_STEPS)[number];
export type PipelineStep = { id: PipelineStepId; enabled: boolean };
export type ParamType = 'string' | 'number' | 'boolean' | 'date';
export type PipelineParam = { name: string; type: ParamType; required: boolean; default?: string | number | boolean; description?: string };
export type ScriptVersion = { id: string; scriptId: string; version: number; sourceSha256: string; params: PipelineParam[]; steps: PipelineStep[]; note: string | null; createdBy: string; createdAt: string; source?: string };
export type PipelineScript = { id: string; slug: string; name: string; description: string | null; language: string; status: 'ACTIVE' | 'ARCHIVED'; versions: ScriptVersion[] };
export type PipelineOverview = { runnerEnabled: boolean; activeScriptVersionId: string | null; scripts: PipelineScript[] };
export type PipelineRun = { id: string; datasetId: string | null; scriptVersionId: string; kind: 'TEST' | 'REPROCESS' | 'IMPORT'; status: 'QUEUED' | 'BLOCKED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; params: Record<string, unknown>; stats: Record<string, unknown> | null; errorCode: string | null; createdAt: string };
export type GroupFields = { datasets: string[]; fields: Array<{ key: string; types: string[]; presentIn: string[]; missingIn: string[]; typeConflict: boolean }> };

export const readPipeline = (organizationId: string, groupId: string) => apiRequest<PipelineOverview>(`${base(organizationId, groupId)}/pipeline`);
export const readScriptVersion = (organizationId: string, groupId: string, scriptId: string, versionId: string) =>
  apiRequest<ScriptVersion>(`${base(organizationId, groupId)}/scripts/${encodeURIComponent(scriptId)}/versions/${encodeURIComponent(versionId)}`);
export const createScript = (organizationId: string, groupId: string, input: { slug: string; name: string }) =>
  apiRequest<PipelineScript>(`${base(organizationId, groupId)}/scripts`, { method: 'POST', body: JSON.stringify(input) });
export const createVersion = (organizationId: string, groupId: string, scriptId: string, input: { source: string; params: PipelineParam[]; steps: PipelineStep[]; note?: string }) =>
  apiRequest<ScriptVersion>(`${base(organizationId, groupId)}/scripts/${encodeURIComponent(scriptId)}/versions`, { method: 'POST', body: JSON.stringify(input) });
export const publishVersion = (organizationId: string, groupId: string, scriptVersionId: string | null) =>
  apiRequest<{ activeScriptVersionId: string | null }>(`${base(organizationId, groupId)}/pipeline`, { method: 'PUT', body: JSON.stringify({ scriptVersionId }) });
export const runPipeline = (organizationId: string, groupId: string, input: { scriptVersionId: string; kind: 'TEST' | 'REPROCESS'; datasetId?: string; params: Record<string, unknown> }) =>
  apiRequest<PipelineRun>(`${base(organizationId, groupId)}/pipeline/runs`, { method: 'POST', body: JSON.stringify(input) });
export const listRuns = (organizationId: string, groupId: string) => apiRequest<PipelineRun[]>(`${base(organizationId, groupId)}/pipeline/runs?limit=30`);
export const groupFields = (organizationId: string, groupId: string) => apiRequest<GroupFields>(`${base(organizationId, groupId)}/fields`);

export const DEFAULT_SOURCE = `# Pipeline script (Python). It runs only inside an isolated runner, never in NORTH or CoreCrow.
# \`rows\` is the batch under processing; \`params\` holds the values declared for this version.

def run(rows, params):
    return rows
`;
