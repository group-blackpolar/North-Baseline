import type { PublishedPanelTab } from '@/context/TabsContext';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';
import { pushPath, replacePath } from '@/lib/routes';
import { resolvePublishedPanel } from '@/lib/organizations';

function panelTitle(names: Record<string, string>, localeOrder: string[], fallback: string) {
  return String(
    localeOrder.map((locale) => names[locale]).find((value) => typeof value === 'string')
      ?? Object.values(names).find((value) => typeof value === 'string')
      ?? fallback
  );
}

/** The tab payload for a resolved published panel (shared by catalog navigation, deep links and tab restore). */
export function publishedTabFromResolved(result: Awaited<ReturnType<typeof resolvePublishedPanel>>): PublishedPanelTab {
  const localeOrder = result.revision
    ? [result.revision.locale.resolved, ...result.revision.locale.fallbackChain, result.revision.defaultLocale]
    : [];
  return {
    id: result.panel.id,
    title: panelTitle(result.panel.name, localeOrder, result.panel.slug),
    document: result.revision?.document ?? null,
    localeOrder,
  };
}

export async function navigateToPublishedTarget(input: {
  organizationSlug?: string;
  category: CategoryModel;
  subcategory?: SubcategoryModel;
  navigate: (categoryId: string, subcategoryId?: string | null, publishedPanel?: PublishedPanelTab) => void;
  history?: 'push' | 'replace' | 'none';
}) {
  const subcategory = input.subcategory ?? input.category.subcategories[0];
  // A screen without a published panel has no panel URL: leave the organization root, never a stale panel path
  // (a reload or the route intent would otherwise reopen the previous panel).
  const leavePanelUrl = () => {
    if (!input.organizationSlug) return;
    const root = `/${encodeURIComponent(input.organizationSlug)}`;
    // Only on an explicit click: the boot-time `replace` must never overwrite a deep link still being resolved.
    if (input.history === 'push') pushPath(root);
  };
  if (!subcategory) {
    input.navigate(input.category.id, null);
    leavePanelUrl();
    return false;
  }

  const panel = subcategory.publishedPanels?.[0];
  if (!input.organizationSlug || !input.category.slug || !subcategory.slug || !panel) {
    input.navigate(input.category.id, subcategory.id);
    leavePanelUrl();
    return false;
  }

  const result = await resolvePublishedPanel({
    organizationSlug: input.organizationSlug,
    categorySlug: input.category.slug,
    subcategorySlug: subcategory.slug,
    panelSlug: panel.slug,
  });
  input.navigate(result.category.id, result.subcategory.id, publishedTabFromResolved(result));
  if (result.canonicalPath && input.history === 'push') pushPath(result.canonicalPath);
  if (result.canonicalPath && input.history === 'replace') replacePath(result.canonicalPath);
  return true;
}
