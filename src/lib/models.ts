export interface SubcategoryModel {
  id: string;
  categoryId: string;
  name: string;
  /** Locale key that overrides `name` for client-owned (non-server) entries. */
  labelKey?: string;
  icon: string;      // nombre de icono resuelto vía iconRegistry
  requiredPermission?: string;
  group?: string;    // agrupación visual dentro del sidebar
  route: string;
  /** Stable server taxonomy key. Never derive routing or admin behavior from a label. */
  slug?: string;
  /** Published server navigation targets. Personal/demo catalogs may omit them. */
  publishedPanels?: Array<{ id: string; name: string; slug: string }>;
  order: number;
}

export interface CategoryModel {
  id: string;
  workspaceId: string | null;
  name: string;
  icon: string;
  /** Stable server taxonomy key. */
  slug?: string;
  requiredPermission?: string;
  order: number;
  subcategories: SubcategoryModel[];
}
