import type { CategoryNode } from "@polivalko/shared/api/types";
import { categoryPhotoUrl } from "@/features/catalog";

export type MenuCategory = Pick<CategoryNode, "id" | "slug" | "name"> & {
  photo: string | null;
  children: MenuCategory[];
};

export function toMenuCategory(category: CategoryNode): MenuCategory {
  return { id: category.id, slug: category.slug, name: category.name,
    photo: categoryPhotoUrl(category), children: (category.children ?? []).map(toMenuCategory) };
}
