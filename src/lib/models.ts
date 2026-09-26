export interface SubcategoryModel {
  id: string;
  categoryId: string;
  name: string;
  icon: string;      // nombre de icono resuelto vía iconRegistry
  requiredPermission?: string;
  group?: string;    // agrupación visual dentro del sidebar
  route: string;
  /** Stable server taxonomy key. Never derive routing or admin behavior from a label. */
  slug?: string;
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
