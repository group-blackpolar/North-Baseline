// Pure model behind the Views workspace: one flat, filterable collection derived from CORECROW's management tree.
// Table, grid, list and grouped modes all render the SAME result of `queryResources`, so there is exactly one place
// where search, filters and sorting are defined. Framework-free so it can be unit-tested with `node --test`.

export type LocalizedText = Record<string, string>;
export type ViewKind = 'CATEGORY' | 'SUBCATEGORY' | 'PANEL';
/** Real statuses only. "In review / Ready / Invalid" do not exist in CORECROW yet (see publishing foundation doc). */
export type ViewStatus = 'ACTIVE' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface TreePanel {
  id: string; name: LocalizedText; description?: LocalizedText | null; slug: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  resourceKind: 'SYSTEM' | 'CONTENT'; audienceType?: string; createdAt?: string; updatedAt?: string;
  publishedRevisionId?: string | null; draftRevisionId?: string | null; subcategoryId: string; navigationHidden?: boolean; accessPolicyMode?: string;
}
export interface TreeSubcategory {
  id: string; name: LocalizedText; description?: LocalizedText | null; slug: string; status: 'ACTIVE' | 'ARCHIVED'; resourceKind: 'SYSTEM' | 'CONTENT';
  createdAt?: string; updatedAt?: string; categoryId: string; panels: TreePanel[];
}
export interface TreeCategory {
  id: string; name: LocalizedText; description?: LocalizedText | null; slug: string; status: 'ACTIVE' | 'ARCHIVED'; resourceKind: 'SYSTEM' | 'CONTENT';
  categoryClass?: 'SYSTEM' | 'TEMPLATE' | 'CUSTOM'; createdAt?: string; updatedAt?: string; subcategories: TreeSubcategory[];
}

export interface ViewResource {
  id: string;
  kind: ViewKind;
  name: LocalizedText;
  description: LocalizedText | null;
  slug: string;
  status: ViewStatus;
  resourceKind: 'SYSTEM' | 'CONTENT';
  categoryId: string;
  categoryName: LocalizedText;
  subcategoryId: string | null;
  subcategoryName: LocalizedText | null;
  parentId: string | null;
  audienceType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  publishedRevisionId: string | null;
  draftRevisionId: string | null;
  /** A published view whose draft differs from what is live. Derived only from real revision ids. */
  hasUnpublishedChanges: boolean;
  /** Children (subcategories for a category, panels for a subcategory); 0 for panels. */
  childCount: number;
}

export function flattenTree(tree: TreeCategory[]): ViewResource[] {
  const out: ViewResource[] = [];
  for (const category of tree) {
    out.push({
      id: category.id, kind: 'CATEGORY', name: category.name, description: category.description ?? null, slug: category.slug, status: category.status,
      resourceKind: category.resourceKind, categoryId: category.id, categoryName: category.name, subcategoryId: null, subcategoryName: null, parentId: null,
      audienceType: null, createdAt: category.createdAt ?? null, updatedAt: category.updatedAt ?? null, publishedRevisionId: null, draftRevisionId: null,
      hasUnpublishedChanges: false, childCount: category.subcategories.length,
    });
    for (const subcategory of category.subcategories) {
      out.push({
        id: subcategory.id, kind: 'SUBCATEGORY', name: subcategory.name, description: subcategory.description ?? null, slug: subcategory.slug, status: subcategory.status,
        resourceKind: subcategory.resourceKind, categoryId: category.id, categoryName: category.name, subcategoryId: subcategory.id, subcategoryName: subcategory.name,
        parentId: category.id, audienceType: null, createdAt: subcategory.createdAt ?? null, updatedAt: subcategory.updatedAt ?? null, publishedRevisionId: null,
        draftRevisionId: null, hasUnpublishedChanges: false, childCount: subcategory.panels.length,
      });
      for (const panel of subcategory.panels) {
        out.push({
          id: panel.id, kind: 'PANEL', name: panel.name, description: panel.description ?? null, slug: panel.slug, status: panel.status, resourceKind: panel.resourceKind,
          categoryId: category.id, categoryName: category.name, subcategoryId: subcategory.id, subcategoryName: subcategory.name, parentId: subcategory.id,
          audienceType: panel.audienceType ?? null, createdAt: panel.createdAt ?? null, updatedAt: panel.updatedAt ?? null,
          publishedRevisionId: panel.publishedRevisionId ?? null, draftRevisionId: panel.draftRevisionId ?? null,
          hasUnpublishedChanges: panel.status === 'PUBLISHED' && Boolean(panel.draftRevisionId) && panel.draftRevisionId !== panel.publishedRevisionId, childCount: 0,
        });
      }
    }
  }
  return out;
}

export type SortKey = 'name' | 'kind' | 'category' | 'status' | 'updatedAt' | 'createdAt';
export interface ViewFilters {
  q: string;
  kinds: string[];
  statuses: string[];
  categoryIds: string[];
  subcategoryIds: string[];
  audiences: string[];
  /** ISO dates (yyyy-mm-dd) inclusive. */
  updatedFrom: string;
  updatedTo: string;
  createdFrom: string;
  createdTo: string;
  unpublishedOnly: boolean;
  /** all | content | system */
  origin: 'all' | 'content' | 'system';
  sort: SortKey;
  dir: 'asc' | 'desc';
}

export const emptyFilters = (): ViewFilters => ({
  q: '', kinds: [], statuses: [], categoryIds: [], subcategoryIds: [], audiences: [], updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '',
  unpublishedOnly: false, origin: 'all', sort: 'updatedAt', dir: 'desc',
});

/** Number of active constraints (sorting and the empty state excluded) — drives the badge and "Clear all". */
export function activeFilterCount(filters: ViewFilters): number {
  return [
    filters.q.trim() ? 1 : 0, filters.kinds.length ? 1 : 0, filters.statuses.length ? 1 : 0, filters.categoryIds.length ? 1 : 0,
    filters.subcategoryIds.length ? 1 : 0, filters.audiences.length ? 1 : 0, filters.updatedFrom || filters.updatedTo ? 1 : 0,
    filters.createdFrom || filters.createdTo ? 1 : 0, filters.unpublishedOnly ? 1 : 0, filters.origin !== 'all' ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

const strings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((item) => strings(item, out));
  return out;
};
const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

export function localName(name: LocalizedText | null | undefined, locale: string): string {
  if (!name) return '';
  return name[locale] ?? name.es ?? name.en ?? Object.values(name)[0] ?? '';
}

/** Search fields that really exist on the resource: name (all locales), description, slug, id, parents, audience, type. */
export function matchesQuery(resource: ViewResource, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  const haystack = [
    ...strings(resource.name), ...strings(resource.description), resource.slug, resource.id, ...strings(resource.categoryName), ...strings(resource.subcategoryName),
    resource.audienceType ?? '', resource.kind, resource.status,
  ].map(fold);
  return needle.split(/\s+/).every((word) => haystack.some((value) => value.includes(word)));
}

const dayStart = (value: string) => Date.parse(`${value}T00:00:00.000Z`);
const dayEnd = (value: string) => Date.parse(`${value}T23:59:59.999Z`);
function inRange(value: string | null, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  return (!from || time >= dayStart(from)) && (!to || time <= dayEnd(to));
}

/** Within one filter group values are OR-ed (multi-select); between groups they are AND-ed. */
export function applyFilters(resources: ViewResource[], filters: ViewFilters): ViewResource[] {
  return resources.filter((resource) => {
    if (!matchesQuery(resource, filters.q)) return false;
    if (filters.kinds.length && !filters.kinds.includes(resource.kind)) return false;
    if (filters.statuses.length && !filters.statuses.includes(resource.status)) return false;
    if (filters.categoryIds.length && !filters.categoryIds.includes(resource.categoryId)) return false;
    if (filters.subcategoryIds.length && !(resource.subcategoryId && filters.subcategoryIds.includes(resource.subcategoryId))) return false;
    if (filters.audiences.length && !(resource.audienceType && filters.audiences.includes(resource.audienceType))) return false;
    if (filters.unpublishedOnly && !resource.hasUnpublishedChanges) return false;
    if (filters.origin !== 'all' && resource.resourceKind !== (filters.origin === 'system' ? 'SYSTEM' : 'CONTENT')) return false;
    if (!inRange(resource.updatedAt, filters.updatedFrom, filters.updatedTo)) return false;
    if (!inRange(resource.createdAt, filters.createdFrom, filters.createdTo)) return false;
    return true;
  });
}

const KIND_ORDER: Record<ViewKind, number> = { CATEGORY: 0, SUBCATEGORY: 1, PANEL: 2 };

export function sortResources(resources: ViewResource[], filters: Pick<ViewFilters, 'sort' | 'dir'>, locale: string): ViewResource[] {
  const direction = filters.dir === 'asc' ? 1 : -1;
  const text = (left: string, right: string) => left.localeCompare(right, locale, { sensitivity: 'base', numeric: true });
  const time = (value: string | null) => (value ? Date.parse(value) || 0 : 0);
  const key = (resource: ViewResource): number | string => {
    switch (filters.sort) {
      case 'name': return localName(resource.name, locale);
      case 'kind': return KIND_ORDER[resource.kind];
      case 'category': return localName(resource.categoryName, locale);
      case 'status': return resource.status;
      case 'createdAt': return time(resource.createdAt);
      default: return time(resource.updatedAt);
    }
  };
  return [...resources].sort((left, right) => {
    const a = key(left); const b = key(right);
    const compared = typeof a === 'number' && typeof b === 'number' ? a - b : text(String(a), String(b));
    return compared !== 0 ? compared * direction : text(localName(left.name, locale), localName(right.name, locale)) || left.id.localeCompare(right.id);
  });
}

export function queryResources(resources: ViewResource[], filters: ViewFilters, locale: string) {
  const matched = sortResources(applyFilters(resources, filters), filters, locale);
  return { matched, total: resources.length };
}

export type GroupBy = 'none' | 'category' | 'status' | 'kind' | 'month';
export function groupResources(resources: ViewResource[], by: GroupBy, locale: string): Array<{ key: string; label: string; items: ViewResource[] }> {
  if (by === 'none') return [{ key: 'all', label: '', items: resources }];
  const groups = new Map<string, { label: string; items: ViewResource[] }>();
  for (const resource of resources) {
    const [key, label] = by === 'category' ? [resource.categoryId, localName(resource.categoryName, locale)]
      : by === 'status' ? [resource.status, resource.status]
        : by === 'kind' ? [resource.kind, resource.kind]
          : [(resource.updatedAt ?? '').slice(0, 7) || 'unknown', (resource.updatedAt ?? '').slice(0, 7) || '—'];
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(resource);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { page: current, pages, items: items.slice((current - 1) * pageSize, current * pageSize), from: items.length ? (current - 1) * pageSize + 1 : 0, to: Math.min(items.length, current * pageSize) };
}

/** Overview metrics that can be computed reliably from the tree alone. */
export function summarize(resources: ViewResource[], now = Date.now()) {
  const panels = resources.filter((resource) => resource.kind === 'PANEL');
  const week = 7 * 24 * 60 * 60_000;
  return {
    categories: resources.filter((resource) => resource.kind === 'CATEGORY' && resource.status === 'ACTIVE').length,
    subcategories: resources.filter((resource) => resource.kind === 'SUBCATEGORY' && resource.status === 'ACTIVE').length,
    views: panels.length,
    published: panels.filter((panel) => panel.status === 'PUBLISHED').length,
    drafts: panels.filter((panel) => panel.status === 'DRAFT').length,
    archived: panels.filter((panel) => panel.status === 'ARCHIVED').length,
    withUnpublishedChanges: panels.filter((panel) => panel.hasUnpublishedChanges).length,
    recentlyUpdated: panels.filter((panel) => panel.updatedAt && now - Date.parse(panel.updatedAt) <= week).length,
  };
}

export interface HealthIssue { id: string; severity: 'warning' | 'info'; code: 'EMPTY_CATEGORY' | 'EMPTY_SUBCATEGORY' | 'NEVER_PUBLISHED' | 'UNPUBLISHED_CHANGES' | 'ARCHIVED_PARENT_ACTIVE_CHILD'; resourceId: string; kind: ViewKind }

/** Problems that are provable from the tree. (Broken dataset references need each draft and are shown per view.) */
export function detectHealth(resources: ViewResource[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  for (const resource of resources) {
    if (resource.resourceKind === 'SYSTEM') continue;
    if (resource.kind === 'CATEGORY' && resource.status === 'ACTIVE' && resource.childCount === 0) issues.push({ id: `empty-cat:${resource.id}`, severity: 'info', code: 'EMPTY_CATEGORY', resourceId: resource.id, kind: resource.kind });
    if (resource.kind === 'SUBCATEGORY' && resource.status === 'ACTIVE' && resource.childCount === 0) issues.push({ id: `empty-sub:${resource.id}`, severity: 'info', code: 'EMPTY_SUBCATEGORY', resourceId: resource.id, kind: resource.kind });
    if (resource.kind === 'PANEL' && resource.status === 'DRAFT' && !resource.publishedRevisionId) issues.push({ id: `never:${resource.id}`, severity: 'info', code: 'NEVER_PUBLISHED', resourceId: resource.id, kind: resource.kind });
    if (resource.kind === 'PANEL' && resource.hasUnpublishedChanges) issues.push({ id: `unpub:${resource.id}`, severity: 'warning', code: 'UNPUBLISHED_CHANGES', resourceId: resource.id, kind: resource.kind });
    if (resource.status !== 'ARCHIVED' && resource.parentId) {
      const parent = byId.get(resource.parentId);
      if (parent?.status === 'ARCHIVED') issues.push({ id: `arch-parent:${resource.id}`, severity: 'warning', code: 'ARCHIVED_PARENT_ACTIVE_CHILD', resourceId: resource.id, kind: resource.kind });
    }
  }
  return issues;
}

// ---- URL / storage serialisation (filters survive reload and can be shared) -------------------------------------------

const LIST_KEYS = ['kinds', 'statuses', 'categoryIds', 'subcategoryIds', 'audiences'] as const;
const PARAM: Record<string, string> = { q: 'vq', kinds: 'vk', statuses: 'vs', categoryIds: 'vc', subcategoryIds: 'vsub', audiences: 'va', updatedFrom: 'vuf', updatedTo: 'vut', createdFrom: 'vcf', createdTo: 'vct', unpublishedOnly: 'vu', origin: 'vo', sort: 'vsort', dir: 'vdir' };
const SORT_KEYS: SortKey[] = ['name', 'kind', 'category', 'status', 'updatedAt', 'createdAt'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function filtersToParams(filters: ViewFilters): URLSearchParams {
  const params = new URLSearchParams();
  const base = emptyFilters();
  if (filters.q.trim()) params.set(PARAM.q!, filters.q.trim());
  for (const key of LIST_KEYS) if (filters[key].length) params.set(PARAM[key]!, filters[key].join(','));
  for (const key of ['updatedFrom', 'updatedTo', 'createdFrom', 'createdTo'] as const) if (filters[key]) params.set(PARAM[key]!, filters[key]);
  if (filters.unpublishedOnly) params.set(PARAM.unpublishedOnly!, '1');
  if (filters.origin !== 'all') params.set(PARAM.origin!, filters.origin);
  if (filters.sort !== base.sort) params.set(PARAM.sort!, filters.sort);
  if (filters.dir !== base.dir) params.set(PARAM.dir!, filters.dir);
  return params;
}

export function paramsToFilters(params: URLSearchParams): ViewFilters {
  const filters = emptyFilters();
  filters.q = (params.get(PARAM.q!) ?? '').slice(0, 200);
  for (const key of LIST_KEYS) filters[key] = (params.get(PARAM[key]!) ?? '').split(',').map((value) => value.trim()).filter((value) => value && value.length <= 128).slice(0, 50);
  for (const key of ['updatedFrom', 'updatedTo', 'createdFrom', 'createdTo'] as const) { const value = params.get(PARAM[key]!) ?? ''; filters[key] = ISO_DAY.test(value) ? value : ''; }
  filters.unpublishedOnly = params.get(PARAM.unpublishedOnly!) === '1';
  const origin = params.get(PARAM.origin!);
  filters.origin = origin === 'content' || origin === 'system' ? origin : 'all';
  const sort = params.get(PARAM.sort!) as SortKey | null;
  filters.sort = sort && SORT_KEYS.includes(sort) ? sort : filters.sort;
  filters.dir = params.get(PARAM.dir!) === 'asc' ? 'asc' : 'desc';
  return filters;
}

export const hasFilterParams = (params: URLSearchParams) => Object.values(PARAM).some((name) => params.has(name));
