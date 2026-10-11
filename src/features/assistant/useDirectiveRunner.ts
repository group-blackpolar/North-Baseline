import { useCallback, useEffect, useRef } from 'react';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import type { Directive } from './protocol.ts';
import { postPanelRequest } from './panelBus.ts';

/**
 * Executes the assistant's UI directives against the real shell: opens the dashboard the way a click in the sidebar would and
 * hands filter requests to that dashboard. Each directive runs once (ids are remembered), and one that names a panel the user
 * cannot see in the catalog is ignored: the catalog is already the user's own authorized navigation.
 */
export function useDirectiveRunner(directives: Directive[]) {
  const { categories } = useCatalog();
  const { activeOrganization } = useOrganization();
  const { navigate, activeTab } = useTabs();
  const done = useRef(new Set<string>());
  const live = useRef({ categories, slug: activeOrganization?.slug, activePanelId: activeTab?.publishedPanel?.id });
  live.current = { categories, slug: activeOrganization?.slug, activePanelId: activeTab?.publishedPanel?.id };

  const run = useCallback(async (entry: Directive) => {
    const { ui } = entry;
    const { categories: tree, slug, activePanelId } = live.current;
    let target: { category: (typeof tree)[number]; subcategory: (typeof tree)[number]['subcategories'][number]; panelSlug: string } | null = null;
    for (const category of tree) for (const subcategory of category.subcategories) {
      const panel = subcategory.publishedPanels?.find((item) => item.id === ui.panelId);
      if (panel) target = { category, subcategory, panelSlug: panel.slug };
    }
    if (!target) return;
    if (activePanelId !== ui.panelId) await navigateToPublishedTarget({ organizationSlug: slug, category: target.category, subcategory: target.subcategory, navigate, history: 'push', panelSlug: target.panelSlug });
    if (ui.type === 'apply_filters') postPanelRequest({ id: entry.id, panelId: ui.panelId, kind: 'apply', replace: ui.replace, filters: ui.filters });
    if (ui.type === 'clear_filters') postPanelRequest({ id: entry.id, panelId: ui.panelId, kind: 'clear', replace: true, filters: [] });
  }, [navigate]);

  useEffect(() => {
    for (const entry of directives) {
      if (done.current.has(entry.id)) continue;
      done.current.add(entry.id);
      void run(entry).catch(() => done.current.delete(entry.id));
    }
  }, [directives, run]);
}
