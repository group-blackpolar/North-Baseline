// Pure model of the import wizard's column mapping. It never invents columns: every draft comes from the workbook analysis
// CORECROW returned, and `toMappingInput` emits exactly the contract the API validates (keys, types, uniqueness).
export type FieldType = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
export type InferredType = FieldType | 'EMPTY' | 'MIXED';
export type ColumnAnalysis = { ordinal: number; header: string | null; inferredType: InferredType; nonEmptyCount: number; nullable: boolean };
export type SheetAnalysis = { ordinal: number; name: string; rowCount: number; columnCount: number; columns: ColumnAnalysis[] };

export type ColumnDraft = {
  ordinal: number;
  header: string | null;
  action: 'CREATE' | 'MAP' | 'IGNORE';
  /** Existing field this column feeds (action MAP): a re-import keeps the stable field ids Views and bindings point at. */
  fieldId?: string;
  key: string;
  displayName: string;
  type: FieldType;
  nullable: boolean;
  inferredType: InferredType;
  nonEmptyCount: number;
};

export const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;
export const FIELD_TYPES: FieldType[] = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'TIME'];

/** "Master Weight (MT)" -> "master_weight_mt"; always starts with a letter and fits the 64-character key limit. */
export function keyFromHeader(header: string | null, ordinal: number): string {
  const slug = (header ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const base = slug && /^[a-z]/.test(slug) ? slug : slug ? `col_${slug}` : `column_${ordinal + 1}`;
  return base.slice(0, 64).replace(/_+$/g, '');
}

/** One draft per source column: the type follows what the analysis found; empty columns are ignored; mixed ones stay text. */
export function suggestMapping(sheet: SheetAnalysis, existing: ReadonlyArray<{ id: string; key: string }> = []): ColumnDraft[] {
  const used = new Set<string>();
  const byKey = new Map(existing.map((field) => [field.key, field.id]));
  return sheet.columns.map((column) => {
    let key = keyFromHeader(column.header, column.ordinal);
    for (let suffix = 2; used.has(key); suffix += 1) key = `${keyFromHeader(column.header, column.ordinal).slice(0, 60)}_${suffix}`;
    used.add(key);
    const type: FieldType = column.inferredType === 'EMPTY' || column.inferredType === 'MIXED' ? 'TEXT' : column.inferredType;
    const fieldId = column.inferredType === 'EMPTY' ? undefined : byKey.get(key);
    return {
      ordinal: column.ordinal, header: column.header, action: column.inferredType === 'EMPTY' ? 'IGNORE' : fieldId ? 'MAP' : 'CREATE', ...(fieldId ? { fieldId } : {}), key, displayName: column.header ?? key, type,
      nullable: column.nullable, inferredType: column.inferredType, nonEmptyCount: column.nonEmptyCount,
    };
  });
}

export type DraftIssue = { ordinal: number; code: 'KEY_INVALID' | 'KEY_DUPLICATE' | 'KEY_EXISTS' | 'NAME_REQUIRED' | 'NOTHING_TO_IMPORT' };

/** Problems that would make CORECROW reject the mapping, found before the request is sent. */
export function validateDrafts(drafts: ColumnDraft[], existingKeys: ReadonlySet<string> = new Set()): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const seen = new Set<string>();
  if (!drafts.some((draft) => draft.action !== 'IGNORE')) issues.push({ ordinal: -1, code: 'NOTHING_TO_IMPORT' });
  const active = drafts.filter((draft) => draft.action === 'CREATE');
  for (const draft of active) {
    if (!FIELD_KEY.test(draft.key)) issues.push({ ordinal: draft.ordinal, code: 'KEY_INVALID' });
    else if (seen.has(draft.key)) issues.push({ ordinal: draft.ordinal, code: 'KEY_DUPLICATE' });
    else if (existingKeys.has(draft.key)) issues.push({ ordinal: draft.ordinal, code: 'KEY_EXISTS' });
    seen.add(draft.key);
    if (!draft.displayName.trim()) issues.push({ ordinal: draft.ordinal, code: 'NAME_REQUIRED' });
  }
  return issues;
}

export type MappingInput = {
  sheetOrdinal: number;
  headerRow: 1;
  duplicates: 'KEEP' | 'SKIP_EXACT';
  columns: Array<{ sourceOrdinal: number; action: 'IGNORE' } | { sourceOrdinal: number; action: 'MAP'; fieldId: string } | { sourceOrdinal: number; action: 'CREATE'; key: string; displayName: Record<string, string>; canonicalType: FieldType; nullable: boolean }>;
};

export function toMappingInput(sheetOrdinal: number, drafts: ColumnDraft[], duplicates: 'KEEP' | 'SKIP_EXACT'): MappingInput {
  return {
    sheetOrdinal, headerRow: 1, duplicates,
    columns: drafts.map((draft) => draft.action === 'IGNORE'
      ? { sourceOrdinal: draft.ordinal, action: 'IGNORE' as const }
      : draft.action === 'MAP' && draft.fieldId
        ? { sourceOrdinal: draft.ordinal, action: 'MAP' as const, fieldId: draft.fieldId }
        : { sourceOrdinal: draft.ordinal, action: 'CREATE' as const, key: draft.key, displayName: { es: draft.displayName.trim(), en: draft.displayName.trim() }, canonicalType: draft.type, nullable: draft.nullable }),
  };
}

export const slugFromName = (name: string) => name.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

/** Stages of an import job in the order the user sees them. Terminal failures carry their own state. */
export const IMPORT_STAGES = ['AWAITING_UPLOAD', 'SECURITY_PENDING', 'SECURITY_APPROVED', 'ANALYZING', 'AWAITING_MAPPING', 'READY_TO_ACTIVATE', 'ACTIVATING', 'SUCCEEDED'] as const;
export const FAILED_STATES = new Set(['SECURITY_BLOCKED', 'ANALYSIS_BLOCKED', 'REJECTED', 'FAILED', 'CANCELLED']);
export const stageIndex = (status: string) => IMPORT_STAGES.indexOf(status as (typeof IMPORT_STAGES)[number]);
