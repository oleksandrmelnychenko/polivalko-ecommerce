import { categoryPhotos } from "@polivalko/shared/lib/stand-in-photos";

export type CategoryPhotoSource = { slug: string; imageUrl?: string | null };

export function categoryPhotoUrl(category: CategoryPhotoSource): string | null {
  return category.imageUrl?.trim() || categoryPhotos[category.slug]?.url || null;
}
