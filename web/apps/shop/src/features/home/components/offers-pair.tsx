import { connection } from "next/server";
import { discountPercent, ProductTiles } from "@/features/catalog";
import { searchProducts } from "@/features/catalog/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";
import { RailTiles } from "./rail-tiles";
import { Strip } from "./strip";

export async function OffersPair() {
  await connection();
  const sale = await searchProducts({ onSale: true, inStock: true, sort: "price_asc", pageSize: 12 });
  const items = (sale?.items ?? []).filter((p) => discountPercent(p.price, p.oldPrice) !== null);
  if (items.length === 0) return null;
  const photo = pagePhotos.offers;
  return (
    <>
      <Look id="offers-title" title="Знижки" sub="Ціна нижча, ніж була" ghost="Для вашого саду" photo={photo}>
        <ProductTiles products={items.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="offers-strip-title" title="Знижки" sub="Ціна нижча, ніж була" side="left">
        <RailTiles products={items.length > 6 ? [...items.slice(6), ...items.slice(0, 6)] : items} />
      </Strip>
    </>
  );
}
