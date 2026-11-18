import { apiRequest } from '@/lib/api';
import type {
  AssignmentRow, AttemptRow, AttemptView, AuthorView, AvailableRow, Block, EvaluationKind, EvaluationRow, EvaluationStatus, Issue, ResultView, Settings, VersionRow,
} from './model';
import type { SaveResponse, Saved } from './answerSync';

/** Typed adapters over the CORECROW /evaluations contracts (ADR 029). CORECROW authorizes, validates, grades and audits every call. */
const base = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}`;
const ev = (organizationId: string, evaluationId?: string) => `${base(organizationId)}/evaluations${evaluationId ? `/${encodeURIComponent(evaluationId)}` : ''}`;
const json = (value: unknown) => JSON.stringify(value);
export type DraftResult = { draftRevision: number; id?: string };
export type QuestionInput = {
  sectionId?: string; passageId?: string | null; category?: string | null; prompt?: Block[]; explanation?: Block[]; points?: number;
  options?: Array<{ id?: string; text: string }>; correctOptionId?: string | null;
};

export const evaluationsApi = {
  // authoring
  list: (o: string, status?: EvaluationStatus) => apiRequest<EvaluationRow[]>(`${ev(o)}${status ? `?status=${status}` : ''}`),
  create: (o: string, input: { kind: EvaluationKind; title: string; description?: string | null }) => apiRequest<AuthorView>(ev(o), { method: 'POST', body: json(input) }),
  get: (o: string, id: string) => apiRequest<AuthorView>(ev(o, id)),
  updateDetails: (o: string, id: string, input: { title?: string; description?: string | null; settings?: Settings; expectedRevision?: number }) => apiRequest<AuthorView>(ev(o, id), { method: 'PATCH', body: json(input) }),
  remove: (o: string, id: string) => apiRequest<void>(ev(o, id), { method: 'DELETE' }),
  duplicate: (o: string, id: string) => apiRequest<AuthorView>(`${ev(o, id)}/duplicate`, { method: 'POST' }),
  archive: (o: string, id: string, archived: boolean) => apiRequest<AuthorView>(`${ev(o, id)}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' }),
  validate: (o: string, id: string) => apiRequest<{ valid: boolean; draftRevision: number; issues: Issue[] }>(`${ev(o, id)}/validate`, { method: 'POST' }),
  publish: (o: string, id: string) => apiRequest<{ id: string; version: number; publishedAt: string; questionCount: number; maxPoints: number }>(`${ev(o, id)}/publish`, { method: 'POST' }),
  versions: (o: string, id: string) => apiRequest<VersionRow[]>(`${ev(o, id)}/versions`),
  assignments: (o: string, id: string) => apiRequest<AssignmentRow[]>(`${ev(o, id)}/assignments`),
  setAssignments: (o: string, id: string, assignments: AssignmentRow[]) => apiRequest<{ count: number }>(`${ev(o, id)}/assignments`, { method: 'PUT', body: json({ assignments }) }),
  attempts: (o: string, id: string) => apiRequest<AttemptRow[]>(`${ev(o, id)}/attempts`),
  // draft operations: every one carries the revision it was based on
  addSection: (o: string, id: string, title: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/sections`, { method: 'POST', body: json({ title, expectedRevision: rev }) }),
  updateSection: (o: string, id: string, sectionId: string, title: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/sections/${sectionId}`, { method: 'PATCH', body: json({ title, expectedRevision: rev }) }),
  removeSection: (o: string, id: string, sectionId: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/sections/${sectionId}?expectedRevision=${rev}`, { method: 'DELETE' }),
  addPassage: (o: string, id: string, input: { title: string; body: Block[] }, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/passages`, { method: 'POST', body: json({ ...input, expectedRevision: rev }) }),
  updatePassage: (o: string, id: string, passageId: string, input: { title?: string; body?: Block[] }, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/passages/${passageId}`, { method: 'PATCH', body: json({ ...input, expectedRevision: rev }) }),
  removePassage: (o: string, id: string, passageId: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/passages/${passageId}?expectedRevision=${rev}`, { method: 'DELETE' }),
  addQuestion: (o: string, id: string, input: QuestionInput & { sectionId: string }, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/questions`, { method: 'POST', body: json({ ...input, expectedRevision: rev }) }),
  updateQuestion: (o: string, id: string, questionId: string, input: QuestionInput, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/questions/${questionId}`, { method: 'PATCH', body: json({ ...input, expectedRevision: rev }) }),
  removeQuestion: (o: string, id: string, questionId: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/questions/${questionId}?expectedRevision=${rev}`, { method: 'DELETE' }),
  reorderQuestions: (o: string, id: string, ids: string[], rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/questions/order`, { method: 'PUT', body: json({ ids, expectedRevision: rev }) }),
  setCorrectOption: (o: string, id: string, questionId: string, optionId: string, rev: number) => apiRequest<DraftResult>(`${ev(o, id)}/questions/${questionId}/correct-option`, { method: 'PUT', body: json({ optionId, expectedRevision: rev }) }),
  // taking
  available: (o: string) => apiRequest<AvailableRow[]>(`${ev(o)}/available`),
  startAttempt: (o: string, id: string) => apiRequest<AttemptView>(`${ev(o, id)}/attempts`, { method: 'POST' }),
  getAttempt: (o: string, attemptId: string) => apiRequest<AttemptView>(`${base(o)}/evaluation-attempts/${encodeURIComponent(attemptId)}`),
  saveAnswers: (o: string, attemptId: string, answers: Saved[]) => apiRequest<SaveResponse>(`${base(o)}/evaluation-attempts/${encodeURIComponent(attemptId)}/answers`, { method: 'PUT', body: json({ answers }) }),
  submit: (o: string, attemptId: string) => apiRequest<ResultView>(`${base(o)}/evaluation-attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST' }),
  result: (o: string, attemptId: string) => apiRequest<ResultView>(`${base(o)}/evaluation-attempts/${encodeURIComponent(attemptId)}/result`),
};
