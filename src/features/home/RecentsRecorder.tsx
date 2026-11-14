import { useEffect } from 'react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { recordRecent } from './recents';

/** Mounted once in the organization shell: remembers every published panel the user opens (UX-01d). */
export function RecentsRecorder({ userId, organizationId }: { userId: string; organizationId: string }) {
  const { activeTab } = useTabs();
  const { categories } = useCatalog();
  const panel = activeTab?.publishedPanel;
  const categoryId = activeTab?.route.categoryId;
  const subcategoryId = activeTab?.route.subcategoryId;
  // The Home itself and administration are destinations, not resources worth coming back to.
  const slug = categories.find((category) => category.id === categoryId)?.slug;
  useEffect(() => {
    if (organizationId === PERSONAL_ORG_ID || !panel || !categoryId || !subcategoryId || !slug || slug === 'home' || slug === 'admin') return;
    recordRecent(userId, organizationId, { panelId: panel.id, categoryId, subcategoryId, title: panel.title, openedAt: Date.now() });
  }, [userId, organizationId, panel?.id, panel?.title, categoryId, subcategoryId, slug]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
