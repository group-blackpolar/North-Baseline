import type { CategoryModel } from '@/lib/models';
import { PERSONAL_WS_ID, SHARK_WS_ID } from '@/lib/demo/store';
import { personalCatalog } from '@/features/personal/catalog';
import { sharkCatalog } from '@/features/shark/catalog';

function customCatalog(workspaceId: string): CategoryModel[] {
  return [
    {
      id: 'home', workspaceId, name: 'Home', icon: 'layout', order: 0,
      subcategories: [
        { id: 'overview', categoryId: 'home', name: 'Overview', icon: 'layout', group: 'General', route: '/home/overview', order: 0 },
      ],
    },
  ];
}

export function demoCatalogFor(workspaceId: string | null): CategoryModel[] | null {
  if (!workspaceId) return null;
  if (workspaceId === PERSONAL_WS_ID) return personalCatalog();
  if (workspaceId === SHARK_WS_ID) return sharkCatalog();
  if (workspaceId.startsWith('ws-')) return customCatalog(workspaceId);
  return null;
}