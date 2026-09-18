import type { CategoryModel } from '@/lib/models';
import { demoCatalogFor } from '@/lib/demo/catalogs';

/** ÚNICO punto a sustituir cuando CoreCrow exponga el catálogo por workspace.
 *  Hoy sirve catálogos demo; mañana llamará a la API de CoreCrow. */
export async function fetchCatalog(workspaceId: string | null): Promise<CategoryModel[]> {
  // Intentar catálogo demo primero
  const demo = demoCatalogFor(workspaceId);
  if (demo) return demo;

  // Fallback: catálogo vacío para orgs reales sin catálogo definido aún
  return [];
}