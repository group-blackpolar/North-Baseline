import { useCallback } from 'react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { adminSectionOf, type AdminSection } from './sections';

// A one-shot hint from a Quick Action to the screen it opens ("invite someone" -> Members, Invitations tab). It lives in
// memory only, is consumed on first read, and never carries data — just which inner tab to show.
let pending: { section: AdminSection; tab: string } | null = null;

export function takeAdminIntent(section: AdminSection): string | null {
  if (pending?.section !== section) return null;
  const { tab } = pending;
  pending = null;
  return tab;
}

/** Opens an Administration capability through the normal tab system (current tab navigates; no extra tabs are created). */
export function useAdminNavigation() {
  const { categories } = useCatalog();
  const { navigate } = useTabs();
  return useCallback((section: AdminSection, tab?: string) => {
    const category = categories.find((item) => item.slug === 'admin');
    if (!category) return;
    const subcategory = category.subcategories.find((item) => adminSectionOf(item) === section);
    pending = tab ? { section, tab } : null;
    navigate(category.id, subcategory?.id ?? null);
  }, [categories, navigate]);
}
