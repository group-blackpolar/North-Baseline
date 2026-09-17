export interface SubcategoryModel {
  id: string;
  categoryId: string;
  name: string;
  icon: string;      // nombre de icono resuelto vía iconRegistry
  requiredPermission?: string;
  group?: string;    // agrupación visual dentro del sidebar
  route: string;
  order: number;
}

export interface CategoryModel {
  id: string;
  workspaceId: string | null;
  name: string;
  icon: string;
  requiredPermission?: string;
  order: number;
  subcategories: SubcategoryModel[];
}