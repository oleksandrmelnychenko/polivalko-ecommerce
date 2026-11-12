import { ProductTilesSkeleton } from "@/features/catalog";

export function LookSkeleton() {
  return (
    <div className="look">
      <div className="look__photo skeleton" />
      <div className="look__content">
        <ProductTilesSkeleton count={6} />
      </div>
    </div>
  );
}
