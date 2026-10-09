import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { keyFromHeader, slugFromName, stageIndex, suggestMapping, toMappingInput, validateDrafts, type SheetAnalysis } from './mappingModel.ts';

const sheet: SheetAnalysis = {
  ordinal: 0, name: 'Sheet1', rowCount: 4, columnCount: 5,
  columns: [
    { ordinal: 0, header: 'Arrival Date', inferredType: 'DATE', nonEmptyCount: 3, nullable: false },
    { ordinal: 1, header: 'Master Weight (MT)', inferredType: 'DECIMAL', nonEmptyCount: 2, nullable: true },
    { ordinal: 2, header: 'Master Weight (MT)', inferredType: 'MIXED', nonEmptyCount: 3, nullable: false },
    { ordinal: 3, header: null, inferredType: 'EMPTY', nonEmptyCount: 0, nullable: true },
    { ordinal: 4, header: '2025 Total', inferredType: 'INTEGER', nonEmptyCount: 3, nullable: false },
  ],
};

test('keys come from headers: ASCII snake_case, starting with a letter, never empty', () => {
  assert.equal(keyFromHeader('Master Weight (MT)', 1), 'master_weight_mt');
  assert.equal(keyFromHeader('Año de Llegada', 0), 'ano_de_llegada');
  assert.equal(keyFromHeader('2025 Total', 4), 'col_2025_total');
  assert.equal(keyFromHeader(null, 3), 'column_4');
  assert.equal(keyFromHeader('!!!', 2), 'column_3');
  assert.ok(keyFromHeader('x'.repeat(200), 0).length <= 64);
});

test('suggestions follow the analysis and de-duplicate keys', () => {
  const drafts = suggestMapping(sheet);
  assert.deepEqual(drafts.map((draft) => [draft.key, draft.type, draft.action]), [
    ['arrival_date', 'DATE', 'CREATE'], ['master_weight_mt', 'DECIMAL', 'CREATE'], ['master_weight_mt_2', 'TEXT', 'CREATE'], ['column_4', 'TEXT', 'IGNORE'], ['col_2025_total', 'INTEGER', 'CREATE'],
  ]);
  assert.deepEqual(validateDrafts(drafts), []);
});

test('a re-import maps columns onto the existing fields by key', () => {
  const drafts = suggestMapping(sheet, [{ id: 'f-date', key: 'arrival_date' }]);
  assert.deepEqual([drafts[0]!.action, drafts[0]!.fieldId, drafts[1]!.action], ['MAP', 'f-date', 'CREATE']);
  assert.deepEqual(toMappingInput(0, drafts, 'KEEP').columns[0], { sourceOrdinal: 0, action: 'MAP', fieldId: 'f-date' });
  assert.deepEqual(validateDrafts(drafts), []);
});

test('validation reports what CORECROW would reject', () => {
  const drafts = suggestMapping(sheet);
  drafts[0]!.key = 'Bad Key';
  drafts[2]!.key = 'master_weight_mt';
  drafts[4]!.displayName = '  ';
  const codes = validateDrafts(drafts, new Set(['col_2025_total'])).map((issue) => `${issue.ordinal}:${issue.code}`);
  assert.deepEqual(codes.sort(), ['0:KEY_INVALID', '2:KEY_DUPLICATE', '4:KEY_EXISTS', '4:NAME_REQUIRED'].sort());
  assert.deepEqual(validateDrafts(drafts.map((draft) => ({ ...draft, action: 'IGNORE' as const }))), [{ ordinal: -1, code: 'NOTHING_TO_IMPORT' }]);
});

test('the mapping payload matches the API contract', () => {
  const input = toMappingInput(0, suggestMapping(sheet), 'SKIP_EXACT');
  assert.equal(input.headerRow, 1);
  assert.equal(input.duplicates, 'SKIP_EXACT');
  assert.deepEqual(input.columns[3], { sourceOrdinal: 3, action: 'IGNORE' });
  assert.deepEqual(input.columns[0], { sourceOrdinal: 0, action: 'CREATE', key: 'arrival_date', displayName: { es: 'Arrival Date', en: 'Arrival Date' }, canonicalType: 'DATE', nullable: false });
});

test('dataset slugs and stage ordering', () => {
  assert.equal(slugFromName('Master House 2026'), 'master-house-2026');
  assert.equal(slugFromName('  Análisis  '), 'analisis');
  assert.ok(stageIndex('SECURITY_APPROVED') < stageIndex('ANALYZING'));
  assert.equal(stageIndex('FAILED'), -1);
});
