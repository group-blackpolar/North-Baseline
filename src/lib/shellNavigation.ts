import { useCallback } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import { pushPath } from '@/lib/routes';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';

/** Single source of truth for shell navigation: desktop rails and the mobile drawer both call these. */
export function useOrganizationNavigation() {
  const { switchOrganization } = useOrganization();
  return useCallback((org: { id: string; slug?: string }) => {
    switchOrganization(org.id);
    const path = org.id === PERSONAL_ORG_ID ? '/workspace' : (org.slug ? `/${encodeURIComponent(org.slug)}` : null);
    if (path) pushPath(path);
  }, [switchOrganization]);
}

export function useCategoryNavigation() {
  const { navigate } = useTabs();
  const { activeOrganization } = useOrganization();
  return useCallback((category: CategoryModel, explicitSub?: SubcategoryModel) => {
    // The rail's platform-administration entry opens the admin route; its own subcategories navigate normally.
    if (category.id === 'platform-administration' && !explicitSub) {
      pushPath('/workspace/admin/dashboard');
      return;
    }
    const subcategory = explicitSub ?? category.subcategories[0];
    void navigateToPublishedTarget({
      organizationSlug: activeOrganization?.slug,
      category,
      subcategory,
      navigate,
      history: 'push',
    }).catch(() => navigate(category.id, subcategory?.id ?? null));
  }, [activeOrganization?.slug, navigate]);
}
