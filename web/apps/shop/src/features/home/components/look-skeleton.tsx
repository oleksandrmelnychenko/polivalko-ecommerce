import { ProductTilesSkeleton } from "@/features/catalog";

export function LookSkeleton() {
  return (
    <div className="look">
      <div className="look__photo skeleton" />
      <span />
      <div className="look__content">
        <ProductTilesSkeleton count={6} />
      </div>
    </div>
  );
}
