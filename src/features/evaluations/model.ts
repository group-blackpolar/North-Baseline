// Framework-free types and helpers for the evaluations UI (unit-tested with `node --test`). They mirror the CORECROW contracts (ADR 029).

export type EvaluationKind = 'EXAM' | 'FORM';
export type EvaluationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type ReviewMode = 'NEVER' | 'AFTER_SUBMIT' | 'AFTER_DATE';

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'image'; assetId: string; alt: string; caption?: string }
  | { type: 'table'; header: string[]; rows: string[][] };

export interface Settings {
  durationMinutes: number | null;
  maxAttempts: number | null;
  scoring: { wrongPenaltyPercent: number; unansweredPenaltyPercent: number; floorAtZero: boolean };
  review: { mode: ReviewMode; revealAfter: string | null };
  ai: { allowedDuringAttempt: boolean };
  /** FORWARD_ONLY: questions open one at a time, each answer is confirmed to the server, nothing closed can be reopened, each question has its own server-timed limit. */
  pacing: { navigation: 'FREE' | 'FORWARD_ONLY'; questionSeconds: number | null };
}
export interface AuthorOption { id: string; text: string }
export interface AuthorQuestion {
  id: string; sectionId: string; passageId: string | null; category: string | null; prompt: Block[]; options: AuthorOption[];
  correctOptionId: string | null; explanation: Block[]; points: number;
  /** Written by the assistant; blocks publication until a person marks it reviewed. */
  aiDraft?: boolean;
}
export interface Section { id: string; title: string; description?: string }
export interface Passage { id: string; title: string; body: Block[] }
export interface AuthorContent { schemaVersion: 1; settings: Settings; sections: Section[]; passages: Passage[]; questions: AuthorQuestion[] }
export interface AuthorView {
  id: string; kind: EvaluationKind; title: string; description: string | null; status: EvaluationStatus; draftRevision: number; publishedRevision: number | null;
  currentVersionId: string | null; hasUnpublishedChanges: boolean; content: AuthorContent; createdAt: string; updatedAt: string;
}
export interface EvaluationRow {
  id: string; kind: EvaluationKind; title: string; description: string | null; status: EvaluationStatus; draftRevision: number; questionCount: number;
  currentVersion: number | null; hasUnpublishedChanges: boolean; updatedAt: string;
}
export interface Issue { code: string; path: string; message: string }
export interface VersionRow { id: string; version: number; publishedAt: string; publishedBy: string; questionCount: number; maxPoints: number }
export interface AssignmentRow { role?: string; groupId?: string; userId?: string; opensAt: string | null; closesAt: string | null }

export interface AvailableRow {
  id: string; kind: EvaluationKind; title: string; description: string | null; durationMinutes: number | null; questionCount: number; maxAttempts: number | null;
  pacing: { navigation: 'FREE' | 'FORWARD_ONLY'; questionSeconds: number | null }; sectionCount: number;
  attemptsUsed: number; openAttemptId: string | null; opensAt: string | null; closesAt: string | null; canStart: boolean;
}
export interface PlayerOption { id: string; label: string; text: string }
export interface PlayerQuestion { id: string; sectionId: string; passageId: string | null; category: string | null; prompt: Block[]; points: number; options: PlayerOption[] }
export interface PlayerContent {
  settings: { durationMinutes: number | null; aiAllowedDuringAttempt: boolean };
  sections: Section[]; passages: Passage[]; questions: PlayerQuestion[];
}
export interface SavedAnswer { questionId: string; optionId: string | null; seq: number }
export interface Group { key: string | null; title: string | null; correct: number; incorrect: number; unanswered: number; timedOut: number; scorePoints: number; maxPoints: number; percent: number }
export interface ReviewItem { questionId: string; number: number; prompt: Block[]; options: PlayerOption[]; selectedOptionId: string | null; correctOptionId: string | null; outcome: 'correct' | 'incorrect' | 'omitted' | 'invalid_timeout'; explanation: Block[] }
export interface ResultView {
  attemptId: string; evaluationId: string; status: AttemptStatus; submittedAt: string | null; correct: number; incorrect: number; unanswered: number; timedOut: number;
  scorePoints: number; maxPoints: number; percent: number; timeUsedSeconds: number;
  breakdown: { byCategory: Group[]; bySection: Group[] };
  review: { available: boolean; policy: ReviewMode; availableAt: string | null; items: ReviewItem[] | null };
}
export interface AttemptView {
  id: string; evaluationId: string; status: AttemptStatus; attemptNumber: number; startedAt: string; deadlineAt: string | null; serverTime: string;
  evaluation: { title: string; description: string | null; kind: EvaluationKind }; remainingSeconds: number | null;
  pacing: { navigation: 'FREE' | 'FORWARD_ONLY'; questionSeconds: number | null };
  /** Paced attempts: closed count, the open question's position and the sessions with their progress. `content` then carries only the open question and its text. */
  progress: { total: number; closed: number; index: number; sections: Array<{ id: string; title: string; description: string | null; total: number; closed: number }> } | null;
  current: { questionId: string; openedAt: string; expiresAt: string | null; remainingSeconds: number | null } | null;
  content: PlayerContent | null; answers: SavedAnswer[]; result: ResultView | null;
}
export interface AttemptRow {
  id: string; userId: string; name: string | null; email: string | null; versionId: string; attemptNumber: number; status: AttemptStatus;
  startedAt: string; submittedAt: string | null; scorePoints: number | null; maxPoints: number | null; percent: number | null;
}

/** Plain text <-> blocks. The editor edits paragraphs; any other block (image, table, list) is kept untouched after them. */
export function blocksToText(blocks: readonly Block[]): string {
  return blocks.flatMap((block) => (block.type === 'paragraph' ? [block.text] : block.type === 'list' ? [block.items.map((item) => `- ${item}`).join('\n')] : [])).join('\n\n');
}
export function textToBlocks(text: string, previous: readonly Block[] = []): Block[] {
  const paragraphs: Block[] = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).map((part) => ({ type: 'paragraph', text: part }));
  return [...paragraphs, ...previous.filter((block) => block.type === 'image' || block.type === 'table')];
}
export const hiddenBlockCount = (blocks: readonly Block[]) => blocks.filter((block) => block.type === 'image' || block.type === 'table').length;

/** Whether the question is ready to publish (mirrors CORECROW's rules; the server is the judge). */
export function questionIssues(question: AuthorQuestion): string[] {
  const issues: string[] = [];
  if (!blocksToText(question.prompt).trim() && question.prompt.length === 0) issues.push('prompt');
  if (question.options.length < 2) issues.push('options');
  if (question.options.some((option) => !option.text.trim())) issues.push('optionText');
  if (!question.correctOptionId) issues.push('correct');
  return issues;
}
export const optionLabel = (index: number) => String.fromCharCode(65 + index);
export const formatPoints = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

// Statistics (phase 6). Mirrors GET /evaluations/:id/stats and /evaluation-results/mine.
export interface StatsVersionRow { id: string; version: number; publishedAt: string; questionCount: number; maxPoints: number; attempts: number; graded: number; meanPercent: number | null }
export interface QuestionStat {
  questionId: string; number: number; category: string | null; prompt: string; attempts: number; correct: number; incorrect: number; omitted: number; timedOut: number; correctRate: number | null;
  options: Array<{ id: string; label: string; picked: number; isCorrect: boolean }>;
}
export interface EvaluationStats {
  attempts: { started: number; inProgress: number; submitted: number; expired: number; graded: number; completionRate: number | null; timedOutRate: number | null };
  score: { meanPercent: number | null; medianPercent: number | null; minPercent: number | null; maxPercent: number | null; distribution: Array<{ from: number; to: number; count: number }> };
  averageTimeSeconds: number | null;
  questions: QuestionStat[]; hardest: string[];
  categories: Array<{ category: string | null; correct: number; incorrect: number; unanswered: number; timedOut: number; meanPercent: number }>;
}
export interface StatsResponse { evaluation: { id: string; title: string }; versions: StatsVersionRow[]; selectedVersionId: string | null; stats: EvaluationStats | null }
export interface MyResultRow { attemptId: string; evaluationId: string; title: string; kind: EvaluationKind; attemptNumber: number; status: AttemptStatus; submittedAt: string | null; scorePoints: number; maxPoints: number; percent: number }

/** Height of a histogram bar relative to the tallest one (at least a sliver for non-empty buckets). */
export function barHeights(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((count) => (max === 0 || count === 0 ? 0 : Math.max(4, Math.round((count / max) * 100))));
}
